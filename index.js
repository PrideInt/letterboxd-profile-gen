const axios = require('axios');

const getDiary = async () => {
    try {
        const response = await axios.get('https://letterboxd.com/pridelightbourn/films/diary/');
        return response.data;
    } catch (error) {
        console.error(error);
    }
};
const diary = getDiary().then((res) => {
    const result = JSON.parse(JSON.stringify(res));

    const titles = result.match(/(?<=data-film-name=")(.*?)(?=")/g);

    const slugs = result.match(/(?<=data-film-slug=")(.*?)(?=")/g);
    const ids = result.match(/(?<=data-film-id=")(.*?)(?=")/g);

    const posters = [];

    for (let i = 0; i < ids.length; i++) {
        const id = ids[i];

        let builder = new StringBuilder('/');
        
        for (let j = 0; j < id.length; j++) {
            builder.append(id[j] + '/');
        }
        const poster = `https://a.ltrbxd.com/resized/film-poster` + builder.toString() + `${ids[i]}-${slugs[i]}-0-1000-0-1500-crop.jpg`;

        posters.push(poster);
    }

    const data = {
        titles: removeDuplicates(titles),
        posters: removeDuplicates(posters),
        slugs: removeDuplicates(slugs),
    }
    return data;
});

diary.then((res) => {
    validatePosters(res.slugs, res.posters).then((res_) => {
        // TODO: do whatever we want now
    });
});

/**
 * Functions
 */

const removeDuplicates = (arr) => {
    return [...new Set(arr)];
};

const validatePosters = async (slugs, posters) => {
    const posters_ = [];

    for (let i = 0; i < posters.length; i++) {
        posters_[i] = posters[i];

        await axios.get(posters[i]).then((res) => {}).catch((err) => {
            if (err.response.status === 404 || err.response.status === 403) {

                getTMDBPoster(slugs[i]).then((res) => {
                    if (res !== null) {
                        posters_[i] = res;
                    }
                });
            }
        });
    }
    return posters_;
}

const getTMDBPoster = async (title) => {
    try {
        const options = {
            method: 'GET',
            url: `https://api.themoviedb.org/3/search/movie?query=${title}`,
            headers: { accept: 'application/json', Authorization: 'Bearer <secret>' }
        };
        const response = await axios.request(options);

        if (response.data['results'].length > 0) {
            return `https://image.tmdb.org/t/p/original${response.data['results'][0]['poster_path']}`
        }
        return null;
    } catch (error) {
        console.error(error);
    }
}

class StringBuilder {
    constructor(value) {
        this.value = value;
    }

    append(value) {
        this.value += value;
        return this;
    }

    toString() {
        return this.value;
    }
}