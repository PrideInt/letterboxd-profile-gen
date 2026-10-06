const axios = require('axios');
const fs = require('fs');
const puppeteer = require('puppeteer');
const { connect } = require("puppeteer-real-browser");

const { createCanvas, loadImage, registerFont } = require('canvas');
const { scrollPageToBottom } = require('puppeteer-autoscroll-down');

require('dotenv').config();

const letterboxdUser = process.env.LETTERBOXD_USER;

/** 
 * @deprecated
 * 
 * OLD; does not update DOM 
 */
const getDiary = async () => {
    try {
        const response = await axios.get(`https://letterboxd.com/${letterboxdUser}/diary/`);
        return response.data;
    } catch (error) {
        console.error(error);
    }
};

/** Updated DOM using Puppeteer */
const getRenderedDiary = async () => {
    const { browser, page } = await connect({
        headless: false,
        args: [],
        customConfig: {},
        turnstile: true,
        connectOption: {},
        disableXvfb: false,
        ignoreAllFlags: false,
    });
 
    await page.goto(`https://letterboxd.com/${letterboxdUser}/diary/`);
 
    await page.evaluate(async () => {
        const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
 
        for (const el of document.querySelectorAll('div[data-component-class="LazyPoster"]')) {
            el.scrollIntoView({ block: 'center' });
            await delay(150);
        }
    });
 
    await page.waitForFunction(
        () => [...document.querySelectorAll('div[data-component-class="LazyPoster"] img.image')]
            .every((img) => !img.src.includes('empty-poster')),
        { timeout: 15000 }
    ).catch(() => console.warn('Some posters did not load in time; falling back to TMDB for those.'));
 
    const rendered = await page.content();
 
    await browser.close();
 
    return rendered;
};

const diary = getRenderedDiary().then((res) => {
    const result = JSON.parse(JSON.stringify(res));

    const username = result.match(/<img src=".*?avatar.*?".*?>/g)[0].match(/(?<=alt=")(.*?)(?=")/g)[0];
    const pfp = result.match(/(?<=<img src=")(.*?)(?=")/g).filter((avatar) => avatar.includes('avatar'))[0].replace('0-48-0-48', '0-220-0-220');

    /*
    
    const titles = validateTitles(
        [...result.matchAll(/data-item-name="([^"]*)"/g)].map((m) => m[1])
    );
    const posters = [...result.matchAll(/srcset="([^\s"]+)/g)].map((m) =>
        m[1].replace('0-70-0-105', '0-1000-0-1500')
    );
    const years = result.match(/(?<=<td class="col-releaseyear -align-center"><span>)(.*?)(?=<\/span>)/g);
    // const ratings = result.match(/(?<=<td class="td-rating rating-green">)(.*?)(?=<\/span>)/g).map((rating) => rating.replace(rating.substring(0, rating.indexOf(' ')), '').replace(' ', ''));
    const ratingsRegex = new RegExp(
        `(?<=<div class="hide-for-owner" data-owner="${letterboxdUser}">)(.*?)(?=</span>)`,
        "g"
    );
    const ratings = result.match(ratingsRegex).map((rating) => rating.substring(rating.indexOf('>') + 1).replace(' ', ''));
    
    */

    /*
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
    */

    /*
    
    const slugs = result.match(/(?<=data-film-slug=")(.*?)(?=")/g);
    const ids = result.match(/(?<=data-film-id=")(.*?)(?=")/g);

    */

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

    const decodeEntities = (str) => str
            .replace(/&quot;/g, '"')
            .replace(/&#0?39;/g, "'")
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&');
    
    const films = result
        .split('data-component-class="LazyPoster"')
        .slice(1)
        .map((chunk) => {
            const rawTitle = chunk.match(/data-item-name="([^"]*)"/)?.[1];
            const fullTitle = rawTitle ? decodeEntities(rawTitle) : null;
            const year = fullTitle?.match(/\((\d{4})\)$/)?.[1] ?? null;
            const title = fullTitle?.replace(/\s*\(\d{4}\)$/, '') ?? null;
            const slug = chunk.match(/data-item-slug="([^"]*)"/)?.[1] ?? null;
        
            const rawPoster = chunk.match(/srcset="([^\s"]+)/)?.[1] ?? chunk.match(/<img[^>]*\ssrc="([^"]+)"/)?.[1];
            const poster = rawPoster && !rawPoster.includes('empty-poster')
                ? rawPoster.replace(/-0-\d+-0-\d+-crop/, '-0-1000-0-1500-crop')
                : null;
        
            const rated = Number(chunk.match(/rated-(\d+)/)?.[1]);
            const rating = rated ? '★'.repeat(Math.floor(rated / 2)) + (rated % 2 ? '½' : '') : null;
        
            return { title, slug, year, poster, rating };
        })
        .filter((film) => film.slug);
    
    const uniqueFilms = [...new Map(films.map((film) => [film.slug, film])).values()];
    
    const data = {
        username: username,
        pfp: pfp,
        titles: uniqueFilms.map((film) => film.title),
        years: uniqueFilms.map((film) => film.year),
        ratings: uniqueFilms.map((film) => film.rating),
        posters: uniqueFilms.map((film) => film.poster),
        slugs: uniqueFilms.map((film) => film.slug),
    };
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

    const canvas = createCanvas(700, 375);
    const ctx = canvas.getContext('2d');

    const recent = res.posters[0];
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
    ctx.fillText(rating ?? '☰', 350, posterY + 205);

    loadImage(pfp).then((pfpImage) => {
        ctx.drawImage(pfpImage, 35, 65, 100, 100);

        loadImage(recent).then((posterImage) => {
            ctx.drawImage(posterImage, 350, posterY, 125, 187.5);

            const buffer = canvas.toBuffer('image/png');
            fs.writeFileSync('recent.png', buffer);
        }).catch((err) => console.error(err));

    }).catch((err) => console.error(err));
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
const validatePosters = async (titles, years, posters) => {
    return Promise.all(posters.map(async (poster, i) => {
        if (poster) {
            try {
                await axios.head(poster);
                return poster;
            } catch (err) {
                const status = err.response?.status;
 
                if (status && status !== 404 && status !== 403) {
                    return poster;
                }
            }
        }
        return (await getTMDBPoster(titles[i], years[i])) ?? poster;
    }));
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

const getTMDBPoster = async (title, year) => {
    if (!title) return null;
 
    try {
        const options = {
            method: 'GET',
            url: 'https://api.themoviedb.org/3/search/movie',
            params: year ? { query: title, year } : { query: title },
            headers: { accept: 'application/json', Authorization: 'Bearer ' + process.env.TMDB_API_KEY }
        };
        const response = await axios.request(options);
 
        const match = response.data.results.find((result) => result.poster_path);
 
        if (match) {
            return `https://image.tmdb.org/t/p/original${match.poster_path}`
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
