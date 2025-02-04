const axios = require('axios');
const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');
require('dotenv').config();

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

    const username = result.match(/<img src=".*?avatar.*?".*?>/g)[0].match(/(?<=alt=")(.*?)(?=")/g)[0];
    const pfp = result.match(/(?<=<img src=")(.*?)(?=")/g).filter((avatar) => avatar.includes('avatar'))[0].replace('0-48-0-48', '0-220-0-220');

    const titles = result.match(/(?<=data-film-name=")(.*?)(?=")/g);
    const years = result.match(/(?<=<td class="td-released center"><span>)(.*?)(?=<\/span>)/g);

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
        username: username,
        pfp: pfp,
        titles: removeDuplicates(titles),
        years: years,
        posters: removeDuplicates(posters),
        slugs: removeDuplicates(slugs),
    }
    return data;
});

diary.then((res) => {
    const username = res.username;
    const pfp = res.pfp;
    const titles = res.titles;

    validatePosters(res.slugs, res.posters).then((res_) => {
        // TODO: do whatever we want now
        const canvas = createCanvas(700, 375);
        const ctx = canvas.getContext('2d');

        const recent = res_[0];
        const recentTitle = titles[0] + ' (' + res.years[0] + ')';

        ctx.font = 'bold 50px courier';
        ctx.fillStyle = 'white';
        ctx.fillText(username, 35, 50);

        ctx.font = 'bold 20px courier';
        ctx.fillStyle = 'white';
        ctx.fillText('just recently watched: ', 35, 200);

        ctx.font = 'bold 20px courier';
        ctx.fillStyle = 'white';

        let wrappedDegree = 0;

        const words = recentTitle.split(' ');

        let line = '';

        for (let i = 0; i < words.length; i++) {
            const word = words[i];

            if (line.length + word.length <= 25) {
                line += word + ' ';
            } else {
                ctx.fillText(line, 350, 65 + wrappedDegree * 25);
                line = word + ' ';
                wrappedDegree++;
            }
        }
        ctx.fillText(line, 350, 65 + wrappedDegree * 25);

        const posterY = 90 + (wrappedDegree * 25);

        loadImage(pfp).then((pfpImage) => {
            ctx.drawImage(pfpImage, 35, 65, 100, 100);

            loadImage(recent).then((posterImage) => {
                ctx.drawImage(posterImage, 350, posterY, 125, 187.5);

                const buffer = canvas.toBuffer('image/png');
                fs.writeFileSync('recent.png', buffer);
            }).catch((err) => console.error(err));

        }).catch((err) => console.error(err));
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
            headers: { accept: 'application/json', Authorization: 'Bearer ' + process.env.TMDB_API_KEY }
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
