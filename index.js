const axios = require('axios');
const fs = require('fs');
const puppeteer = require('puppeteer');

const { createCanvas, loadImage, registerFont } = require('canvas');
const { scrollPageToBottom } = require('puppeteer-autoscroll-down');

require('dotenv').config();

/** 
 * @deprecated
 * 
 * OLD; does not update DOM 
 */
const getDiary = async () => {
    try {
        const response = await axios.get('https://letterboxd.com/pridelightbourn/films/diary/');
        return response.data;
    } catch (error) {
        console.error(error);
    }
};

/** Updated DOM using Puppeteer */
const getRenderedDiary = async () => {
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'], ignoreDefaultArgs: ['--disable-extensions']});
    const page = await browser.newPage();

    await page.goto('https://letterboxd.com/pridelightbourn/films/diary/');

    let isLoadingAvailable = true;

    while (isLoadingAvailable) {
        await scrollPageToBottom(page, { size: 500 });
        await page.waitForFunction('document.querySelector("img[srcset]")');

        isLoadingAvailable = false;
    }
    const rendered = await page.content();

    await browser.close();

    return rendered;
};

const diary = getRenderedDiary().then((res) => {
    const result = JSON.parse(JSON.stringify(res));

    const username = result.match(/<img src=".*?avatar.*?".*?>/g)[0].match(/(?<=alt=")(.*?)(?=")/g)[0];
    const pfp = result.match(/(?<=<img src=")(.*?)(?=")/g).filter((avatar) => avatar.includes('avatar'))[0].replace('0-48-0-48', '0-220-0-220');

    const titles = validateTitles(result.match(/(?<=data-film-name=")(.*?)(?=")/g));
    const years = result.match(/(?<=<td class="col-releaseyear _aligncenter"><span>)(.*?)(?=<\/span>)/g);
    // const ratings = result.match(/(?<=<td class="td-rating rating-green">)(.*?)(?=<\/span>)/g).map((rating) => rating.replace(rating.substring(0, rating.indexOf(' ')), '').replace(' ', ''));
    const ratings = result.match(/(?<=<td class="col-rating _paddinginlinelg">)(.*?)(?=<\/span>)/g);

    for (let i = 0; i < ratings.length; i++) {
        let idx = ratings[i].length - 1;
        while (true) {
            if (ratings[i].charAt(idx) !== '>') {
                --idx;
            } else {
                break;
            }
        }
        ratings[i] = ratings[i].substring(idx + 1, ratings[i].length).replace(' ', '');
    }

    const slugs = result.match(/(?<=data-film-slug=")(.*?)(?=")/g);
    const ids = result.match(/(?<=data-film-id=")(.*?)(?=")/g);

    const posters = result.match(/(?<=srcset=")(.*?)(?=")/g).map((poster) => poster.replace('0-70-0-105', '0-1000-0-1500'));

    /*
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
    */

    const data = {
        username: username,
        pfp: pfp,
        titles: removeDuplicates(titles),
        years: years,
        ratings: ratings,
        posters: removeDuplicates(posters),
        slugs: removeDuplicates(slugs),
    }
    return data;
});

diary.then((res) => {
    const username = res.username;
    const pfp = res.pfp;
    const titles = res.titles;
    const ratings = res.ratings;

    registerFont('./public/fonts/CourierPrime-Bold.ttf', {
        family: 'Courier',
    });

    validatePosters(res.slugs, res.posters).then((res_) => {
        const canvas = createCanvas(700, 375);
        const ctx = canvas.getContext('2d');

        const recent = res_[0];
        const recentTitle = titles[0] + ' (' + res.years[0] + ')';

        const rating = ratings[0];

        ctx.font = 'bold 50px Courier';
        ctx.fillStyle = '#808080';
        ctx.fillText(username, 35, 50);

        ctx.font = 'bold 20px Courier';
        ctx.fillStyle = '#808080';
        ctx.fillText('just recently watched: ', 35, 200);

        ctx.font = 'bold 20px Courier';
        ctx.fillStyle = '#808080';

        let wrappedDegree = 0;

        const words = recentTitle.split(' ');

        let title = '';

        for (let i = 0; i < words.length; i++) {
            const word = words[i];

            if (title.length + word.length <= 25) {
                title += word + ' ';
            } else {
                ctx.fillText(title, 350, 75 + wrappedDegree * 25);
                title = word + ' ';
                wrappedDegree++;
            }
        }
        ctx.fillText(title, 350, 75 + wrappedDegree * 25);

        const posterY = 95 + (wrappedDegree * 25);

        ctx.font = 'bold 15px serif';
        ctx.fillStyle = '#808080';
        ctx.fillText(rating, 350, posterY + 205);

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

/**
 * Failsafe if Letterboxd posters don't render
 * 
 * @param {*} slugs 
 * @param {*} posters 
 * @returns 
 */
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

const validateTitles = (titles) => {
    const titles_ = [];

    for (let i = 0; i < titles.length; i++) {
        let title = titles[i];

        /**
         * Letterboxd sometimes returns titles with HTML entities
         * This replaces them with their actual characters
         */
        if (titles[i].includes('&#39;') || titles[i].includes('&amp;')) {
            title = titles[i].replace('&amp;', '&').replace('&#39;', '\'');
        }
        titles_[i] = title;
    }
    return titles_;
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
