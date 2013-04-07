import urllib
import urlparse


class URL(object):
    def __init__(self, scheme='http', netloc='', path='', params='', fragment='', **kwargs):
        self.__dict__['scheme'] = scheme
        self.__dict__['netloc'] = netloc
        self.__dict__['path'] = path
        self.__dict__['params'] = params
        self.__dict__['fragment'] = fragment
        self.__dict__['query'] = kwargs

    def __setattr__(self, name, value):
        if name in self.__dict__:
            self.__dict__[name] = value
        else:
            self.query[name] = value

    def __getattr__(self, name):
        try:
            return self.__dict__[name]
        except KeyError:
            return self.query[name]

    def __delattr__(self, name):
        if name in self.query:
            del self.query[name]

    def __dir__(self):
        """Override dir() to include the querystring parameters

        Doing this makes the dir() command work correctly and also allows tab
        completion (e.g., in ipython) work correctly for the querystring
        parameters.

        See http://bit.ly/XRdvCf for documentation on how to correclty override
        the __dir__ method.
        """
        attrs = set(dir(type(self)) + self.__dict__.keys() + self.query.keys())
        return list(attrs)

    def __str__(self):
        return self.to_string()

    def __repr__(self):
        return '<%s url=%s>' % (self.__class__.__name__, str(self))

    def to_string(self):
        parsed_url = urlparse.ParseResult(
            scheme=self.scheme,
            netloc=self.netloc,
            path=self.path,
            params=self.params,
            query=urllib.urlencode(self.query),
            fragment=self.fragment
        )
        url = urlparse.urlunparse(parsed_url)
        return url
