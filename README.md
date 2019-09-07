![Room Logo](https://i.imgur.com/WKfsXS9.png)

ROOM is both a visual studio and a platform. Our primary public-facing output is a weekly genre-free mix series that is hosted on SoundCloud and our site. On the studio side, we handle web development, album/single art, posters, print design, 3D modeling, live visuals, production, mixing/mastering, among other disciplines.

## Local Development
To start local development, run `npm start`.

## Deployment
- Install the [AWS CLI](https://aws.amazon.com/cli/) via `pip install awscli` for Mac/Linux. If using windows, amazon provides an installer on their website.
- Configure the CLI to use the correct keys by running `aws configure`.
- Run `npm run deploy`. This will bundle and deploy the code you have on your machine, not on github, so make sure you have the latest version of the repo before running this command.