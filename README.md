# Ballot — a real polling website

This is a complete, ready-to-deploy Next.js app: create a poll, get a shareable
link, anyone can vote once, results update live. Database is Turso (SQLite),
hosting is Vercel.

## What you need first
- A free GitHub account — github.com
- A free Turso account — turso.tech
- A free Vercel account — vercel.com (sign in with GitHub, it's easier)

## Step 1 — put this code on GitHub
1. Go to github.com → New repository → name it `ballot` → Create.
2. On your computer, unzip this project, open a terminal inside the folder, and run:
   ```
   git init
   git add .
   git commit -m "Ballot v1"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/ballot.git
   git push -u origin main
   ```
   (Replace YOUR-USERNAME. GitHub will show you this exact command on the empty repo page too.)

## Step 2 — create your Turso database
1. Install the Turso CLI (one-time, run in terminal):
   ```
   curl -sSfL https://get.tur.so/install.sh | bash
   ```
2. Sign up / log in:
   ```
   turso auth signup
   ```
3. Create the database:
   ```
   turso db create ballot
   ```
4. Get your connection URL:
   ```
   turso db show ballot --url
   ```
5. Create an auth token:
   ```
   turso db tokens create ballot
   ```
   Save both values — you'll paste them into Vercel in Step 4.

## Step 3 — load the database schema
Still in the project folder on your computer:
```
npm install
TURSO_DATABASE_URL="paste-url-here" TURSO_AUTH_TOKEN="paste-token-here" npm run db:push
```
This creates the `polls`, `options`, and `votes` tables in your Turso database.

## Step 4 — deploy to Vercel
1. Go to vercel.com → Add New → Project → import your `ballot` GitHub repo.
2. Before clicking Deploy, open "Environment Variables" and add:
   - `TURSO_DATABASE_URL` = (from step 2)
   - `TURSO_AUTH_TOKEN` = (from step 2)
3. Click Deploy. In about a minute you'll get a live URL like `ballot-yourname.vercel.app`.

That's it — that URL is your real, live polling site. Anyone with a poll link
can vote from any device.

## How voting is kept fair
Each browser gets a private cookie the first time it votes on a poll. That
cookie is checked before every vote, so the same browser can't vote twice on
the same poll. It's not bulletproof (clearing cookies resets it) but it
matches what most free polling tools do.

## Local development
```
npm install
cp .env.example .env.local   # fill in your Turso values
npm run dev
```
Visit http://localhost:3000
