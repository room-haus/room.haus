module.exports = {
  siteMetadata: {
    title: 'ROOM',
  },
  plugins: [
    'gatsby-plugin-root-import',
    'gatsby-plugin-react-helmet',
    'gatsby-plugin-styled-components',
    'gatsby-plugin-favicon',
    {
      resolve: 'gatsby-plugin-google-analytics',
      options: {
        trackingId: 'UA-120916716-1',
      },
    },
    {
      resolve: 'gatsby-plugin-facebook-pixel',
      options: {
        pixelId: '1884152954974631',
      },
    },
    {
      resolve: 'gatsby-plugin-mailchimp',
      options: {
        endpoint: 'https://haus.us19.list-manage.com/subscribe/post?u=0f6742d7b6230e568f9a7e812&amp;id=23a9efd881',
      },
    },
    'gatsby-plugin-remove-serviceworker',
  ],
};
