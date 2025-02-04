# Letterboxd Profile Generator

Generating PNG files from your Letterboxd profile, so you can add it to your cool little
GitHub README.

# Output

The output results in this:

> The following file is rendered through the source:
> https://github.com/PrideInt/letterboxd-profile-gen/blob/master/recent.png
> , which is updated periodically, hence it updates dynamically when referenced through this source.

<br>

![](https://github.com/PrideInt/letterboxd-profile-gen/blob/master/recent.png)

# Requirements

Anyone can fork this repository and render their own Letterboxd profile! In order to do so:
- You need to add a GitHub Actions secret named `TMDB_API_KEY` with your TMDB API key.
- Replace the username located on line 8 in `index.js` with your own.
- Boom!
