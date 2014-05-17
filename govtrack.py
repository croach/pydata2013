#!/usr/bin/env python

"""Analyze congressional partisanship using Social Network Analysis.

This script will download data from govtrack.us on bills that were
introduced in a specific meeting of congress and for one of the two
houses. The bill data is then used to construct a network of
congressional members where edges between members of congress are
based on the number of bills the two members have cosponsored
together.

Since the downloading of bill data can take a very long time and put
stress on the free (and excellent) govtrack.us API, this script
automatically caches the downloaded data after its first
retrieval. The data is cached into a hidden directory called .cache in
the same directory where the script is located. To ignore the cached
data and retrieve it again, you can use the --ignore-cache option.

As an example of how to use the script, if you wanted to view the
network for the House of Representatives of the 112th congress
(January 3, 2011 - January 3, 2013), and you want to see it in the
browser, you could use the following command:

    $ python {0} -b --resize=betweenness 112 lower

A few things to notice in the previous command: First, you could have
also used 'representatives' in place of lower, if it makes the command
a little more intuitive for you. Second, the '-b' (--browser) option
turns on in-browser viewing. Finally, the '-r' (--resize) option turns
on resizing of the nodes relative to a given centrality statistic, at
this point the 'resize' value can be set to either 'degree' or
'betweenness'.

To output the graph to a file for examination in a third party tool,
use the '--output' (or '-o') option. To use this option you must give
a filename to which the graph will be written. The format of the
resultant file is based on the given filename's extension. As an
example, you could output the graph for the 112th meeting of the
senate in GraphML format with the following command:

    $ python {0} -o 112_senate.graphml 112 senate

"""

import os
import sys
import urllib2
import re
import copy
import argparse
from multiprocessing import Process
from SimpleHTTPServer import SimpleHTTPRequestHandler
from SocketServer import TCPServer
import webbrowser

try:
    import simplejson as json
except ImportError:
    import json

import networkx as nx
from networkx.readwrite import json_graph

import url
import progress


class GovTrackURL(url.URL):
    def __init__(self, netloc='www.govtrack.us', **kwargs):
        super(GovTrackURL, self).__init__(netloc=netloc, **kwargs)

class Graph(nx.Graph):
    """NetworkX Graph subclass that supports serialization to a file
    """

    supported_formats = {
        '.adjlist': 'adjlist',
        '.edgelist': 'edgelist',
        '.gexf': 'gexf',
        '.gml': 'gml',
        '.gpickle': 'gpickle',
        '.graphml': 'graphml',
        '.yaml': 'yaml',
        '.net': 'pajek',
    }

    def write_graph(self, filename):
        """Writes the graph to the file with format based on file extension
        """
        _, ext = os.path.splitext(filename)
        try:
            format = self.supported_formats[ext.lower()]
        except KeyError:
            raise ValueError("No format could be found for the extension '%s'. " \
                             "The supported formats are [%s]" %
                             (ext, ', '.join(self.supported_formats.keys())))

        write_fn = getattr(nx, 'write_%s' % format)
        write_fn(self, filename)


def get_bills(congress, house, limit=None):
    """Returns an iterator over the bills introduced in the given congress.

    Arguments:
    congress -- the number for the meeting of congress (the ???th congress)
    house -- the house ([lower|representatives] or [upper|senate])

    Keyword Arguments:
    limit -- the number of bills to return

    """
    path = '/api/v2/bill'
    if house in ['lower', 'representatives']:
        bill_type = 'house_bill'
    elif house in ['upper', 'senate']:
        bill_type = 'senate_bill'
    else:
        raise ValueError('invalid value for house, expected lower (representatives) or upper (senate): %s' % house)
    return query_api(path, congress=congress, bill_type=bill_type, limit=limit)


def query_api(path, retry=3, limit=None, **kwargs):
    """Returns an iterator over the objects returned from the govtrack.us API.

    All additional keyword paramaters are passed onto the govtrack.us API in
    the form of key/value pairs in the querystring of the URL. For further
    information on the parameters available see the govtrack.us API docs at
    http://www.govtrack.us/developers/api.

    Arguments:
    path -- the filepath of the API endpoint to query

    Keyword Arguments:
    limit -- the number of objects to return. If None (default), all objects
        are returned
    retry -- the number of times to try getting an object (default is 3)

    """
    url = GovTrackURL(path=path, **kwargs)
    while True:
        response = json.load(urllib2.urlopen(url.to_string()))
        meta = response['meta']
        objects = response['objects']
        offset = meta['offset']
        limit = limit if limit is not None else meta['total_count']
        for obj in objects:
            offset += 1
            progress = int((float(offset)/limit) * 100)
            obj_url = GovTrackURL(path='%s/%s' % (path, obj['id']))
            # Sometimes we get back a 502 error. If we do, just try getting the
            # object again. Attempt up to the 'retry' limit (default is 3)
            for i in range(retry):
                try:
                    yield json.load(urllib2.urlopen(obj_url.to_string())), progress
                    break
                except urllib2.HTTPError:
                    pass

            # If the limit argument is set, exit after we've reached that limit
            if limit is not None and offset >= limit:
                return

        # Update the current offset value and, if we've retrieved all of the
        # objects available, exit this function
        url.offset = meta['offset'] + meta['limit']
        # if url.offset > meta['total_count']:
        #     return


def party_affiliation(name):
    """Returns the member's political party affiliation

    Given a name with the following format:
        TITLE FIRST_NAME LAST_NAME [PARTY_AFFILIATION-DISTRICT_OR_STATE]
    this function parses out the party affiliation and returns it.

    """
    parties = {'R': 'republican', 'D': 'democrat', 'I': 'independent'}
    party_abbrev = re.search('\[([A-Z])-[A-Z]{2}[^\]]*\]', name).groups()[0]
    try:
        return parties[party_abbrev]
    except KeyError:
        return party_abbrev


def clean_node_attr_dict(attr_dict):
    """Cleans up the given node attribute dict.

    This function is used to clean up a node's attribute dict before adding
    it to the graph. It removes some attributes that are unnecessary and
    potentially harmful when writing the graph to disk and adds the node's
    party affiliation.

    Arguments:
    attr_dict -- the node attribute dict to be cleaned

    """
    n = copy.deepcopy(attr_dict)

    # These id's are missing for many members of congress, and when they're
    # missing, they break serialization of the graph and since I don't use
    # them, I can just delete them from the node.
    del n['youtubeid']
    del n['twitterid']
    del n['cspanid']

    # When the node is serialized, Networkx takes the key associated with the
    # node in the Graph's node dict (e.g., G.node[key]) and adds it to the
    # serialized node dict with the key 'id'. If an 'id' key already exists
    # in the node's attr_dict, a conflict occurs. This code changes the name
    # of the node's 'id' to 'govtrackid' to prevent this conflict from occuring.
    n['govtrackid'] = n.pop('id')

    # Add the member's party affiliation (parsed from their name)
    n['party_affiliation'] = party_affiliation(n['name'])
    return n


def create_graph(bills):
    """Creates a Networkx graph for the given list of bills

    This function creates a graph where the nodes represent members of congress
    and the the edges between them represent that the two members have worked
    together on a bill. Each edge has a weight value based on the number of
    bills the two members have worked on together.

    Arguments:
    bills -- a list of dicts where each dict represents a bill in congress

    """
    g = Graph()
    for bill in bills:
        sponsor = clean_node_attr_dict(bill['sponsor'])
        if not g.has_node(sponsor['bioguideid']):
            g.add_node(sponsor['bioguideid'], attr_dict=sponsor)
        for cosponsor in bill['cosponsors']:
            cosponsor = clean_node_attr_dict(cosponsor)
            if not g.has_node(cosponsor['bioguideid']):
                g.add_node(cosponsor['bioguideid'], attr_dict=cosponsor)
            if g.has_edge(sponsor['bioguideid'], cosponsor['bioguideid']):
                g[sponsor['bioguideid']][cosponsor['bioguideid']]['weight'] += 1
            else:
                g.add_edge(sponsor['bioguideid'], cosponsor['bioguideid'], attr_dict={'weight': 1})
    return g


def trim_edges(graph, weight=1):
    """Returns a copy of the given graph with edges trimmed by weight.

    Arguments_api:
    graph -- the graph to trim

    Keyword arguments:
    weight -- the value for which all edges with weights equal to, or less than
        it, will be removed (default 1).

    """
    g = graph.copy()
    trimmed_edges = []
    for u, v in g.edges():
        if g[u][v]['weight'] <= weight:
            trimmed_edges.append((u, v))
    g.remove_edges_from(trimmed_edges)
    return g


def sort_nodes(graph, m, desc=True):
    """Returns a list of nodes sorted according to the given mapping.

    Arguments:
    graph -- the graph whose nodes will be sorted
    m -- a mapping (dict) of nodes to their relative value in the graph

    Keyword Arguments:
    desc -- set to True to sort descending (default), False for ascending

    """
    sorted_keys = sorted(m.iteritems(), key=lambda (k, v): (v, k), reverse=desc)
    nodes = [graph.node[k] for k, _ in sorted_keys]
    return nodes


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__.format(sys.argv[0]),
        formatter_class=argparse.RawTextHelpFormatter)
    parser.add_argument('session', type=int, metavar='SESSION',
        help='session of congress (e.g., 112 for the 112th congress)')
    parser.add_argument('house', metavar='HOUSE',
        choices=['lower', 'representatives', 'upper', 'senate'],
        help='house of congress (lower/representatives, upper/senate)')
    parser.add_argument('--ignore-cache', action='store_true',
        help='ignore the cache and do a fresh download of all bills')
    parser.add_argument('--limit', '-l', type=int,
        help='number of bills to download (all bills by default)')
    parser.add_argument('--trim', '-t', type=int, metavar='WEIGHT',
        help='remove all edges at or below the given weight')
    parser.add_argument('--resize', '-r', choices=['degree', 'betweenness'],
        help='resize nodes relative to a centrality metric')
    parser.add_argument('--browser', '-b', action='store_true',
        help='show the network visualization in a browser (uses D3)')
    parser.add_argument('--output', '-o', metavar='OUTPUT_FILE',
        help='output the network to the given file')
    args = parser.parse_args()

    root_dir = os.path.dirname(os.path.realpath(__file__))
    cache_dir = os.path.join(root_dir, '.cache')

    # Create the .cache directory if it doesn't already exist
    if not os.path.exists(cache_dir):
        os.makedirs(cache_dir)

    # Get the bills (either from cache or a fresh download)
    house = 'lower' if args.house in ['lower', 'representatives'] else 'senate'
    cache_filepath = os.path.join(cache_dir, '%s_%s.json' % (args.session, house))
    if args.ignore_cache or not os.path.exists(cache_filepath):
        bills = []
        progress.progress_bar(0)
        for bill, i in get_bills(args.session, args.house, limit=args.limit):
            bills.append(bill)
            progress.progress_bar(i)
        with open(cache_filepath, 'w') as fout:
            json.dump(bills, fout)
    else:
        with open(cache_filepath, 'r') as fin:
            bills = json.load(fin)

    g = create_graph(bills)
    if args.trim is not None:
        g = trim_edges(g, weight=args.trim)

    # Calculate the betweenness centralities of the nodes. Removing the weakest
    # edges before calculating the betweenness centralities mainly just for
    # visualization purposes, so it's possible to visually discern which nodes
    # have stronger relationships with their colleagues and betweenness.
    betweenness_centralities = nx.centrality.betweenness_centrality(trim_edges(g, weight=10), normalized=False)
    degrees = nx.degree(trim_edges(g, weight=10))
    for node_id in g.nodes():
        g.node[node_id]['betweenness'] = betweenness_centralities[node_id]
        g.node[node_id]['degree'] = degrees[node_id]

    if args.output is not None:
        g.write_graph(args.output)
    elif args.browser:
        # TODO: Create a script that compiles all external files into the
        #       govtrack file (see virtualenv for details on how to do this).
        #       With that done, create all of the HTML, CSS, and JS files on
        #       invocation and write them to a temp directory.

        # Serialize the graph to the network.json file
        pwd = os.path.dirname(os.path.realpath(__file__))
        browser_dir = os.path.join(pwd, 'browser')
        network_file = os.path.join(browser_dir, 'js', 'network.json')
        with open(network_file, 'w') as fout:
            if args.resize is not None:
                g.graph['resize'] = args.resize
            json_graph.dump(g, fout)

        # Switch to the browser directory and start up a simple HTTP server
        os.chdir(browser_dir)
        Server = type('Server', (TCPServer, object), {'allow_reuse_address': True})
        httpd = Server(("", 8080), SimpleHTTPRequestHandler)
        p = Process(target=httpd.serve_forever)
        p.start()
        webbrowser.open("http://localhost:8080")
        try:
            print "Press Ctrl-c to quit..."
            p.join()
        except KeyboardInterrupt:
            p.terminate()
    else:
        # We only import matplotlib if the user opts to display the network
        # outside of the browser since installing matplotlib can be a bear
        # sometimes
        import matplotlib.pyplot as plt

        pos = nx.fruchterman_reingold_layout(g)
        dems = [n for n in g.nodes() if g.node[n]['party_affiliation'] == 'democrat']
        reps = [n for n in g.nodes() if g.node[n]['party_affiliation'] == 'republican']
        inds = [n for n in g.nodes() if g.node[n]['party_affiliation'] == 'independent']

        node_size = lambda nid: g.node[nid][args.resize] if args.resize else 300

        nx.draw_networkx_nodes(g, pos, nodelist=dems, node_color='blue', node_size=map(node_size, dems))
        nx.draw_networkx_nodes(g, pos, nodelist=reps, node_color='red', node_size=map(node_size, reps))
        nx.draw_networkx_nodes(g, pos, nodelist=inds, node_color='gray', node_size=map(node_size, inds))
        nx.draw_networkx_edges(g, pos, alpha=0.05)
        plt.show()
