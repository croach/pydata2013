## PyData 2013 - Intro to Network Science

This is the code for my ["Intro to Network Science"][talk] talk from [PyData][pydata] 2013 (Silicon Valley).

### Software

- [Networkx][networkx] - (required) used for the network analysis
- [Matplotlib][matplotlib] - (optional) needed for non browser-based visualization only

### Running the code

To run the code, just run the `govtrack.py` script with the number for the session of congress and the name of the house of congress that you wish to study. So, for example, to study the Senate for the 112th congress, you can simply run the following command:

    $ python govtrack.py 112 senate
    
To run the command above you must have matplotlib installed since the app uses it for visualization by default. It is recommended, however, that you use the `-b` (`--browser`) option instead since the in-browser visualization is now more fully featured than the default matplotlib one. Also, if you choose to use the in-browser visualization, you can skip the matplotlib installation as it is not used for any other part of the visualization.
  
To see an explanation of how the script works and the options available, just execute the script with the `-h` option.

[talk]: https://vimeo.com/63270822
[pydata]: http://pydata.org
[networkx]: http://networkx.github.io
[matplotlib]: http://matplotlib.org
