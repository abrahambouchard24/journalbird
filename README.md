# JournalBird

A daily journal in three parts, each with its own bird.

- **Morning, Bluebird:** morning pages, one intention, a checklist, notes.
- **Day, Cardinal:** your morning stays pinned, you check tasks off, log moods and moments.
- **Night, Owl:** a recap of the day, what went well, bedtime notes, and night pages. Then "Say goodnight".

The day moves forward only when you press the button (Begin my day, Wind down for the night, Say goodnight). A new day starts at local midnight regardless, and earlier days are kept under **Journal** (with search, a streak and word count). You can always go back and edit earlier parts of today. Tap a bird to hear it and hear what it has to say.

Everything is saved on the device (localStorage). **Me** has a name for the birds to use, plus backup and restore as a JSON file.

## Files

- `journalbird.html`: the whole app, one file (same style and fonts as RISING).
- `build.mjs`: wraps it into an installable home-screen app in `app/` (manifest, bluebird icon, offline service worker).
- `app/`: generated; don't edit by hand.

## Build and try it

```bash
node build.mjs
```

```bash
python -m http.server 8790 --directory app
```

Then open http://localhost:8790. To put it on a phone, host the `app/` folder anywhere with HTTPS (GitHub Pages, Netlify, Cloudflare Pages), open it there, and choose **Add to Home Screen**.
