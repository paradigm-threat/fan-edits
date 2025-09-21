const fs = require('fs');
const path = require('path');
const MarkdownIt = require('markdown-it');
const nodemailer = require('nodemailer');
require('dotenv').config({ path: '../.env.local'});


const {
  SMTP_SERVER_HOST,
  SMTP_SERVER_USERNAME,
  SMTP_SERVER_PASSWORD,
} = process.env;
const transporter = nodemailer.createTransport({
  service: 'gmail',
  host: SMTP_SERVER_HOST,
  port: 587,
  secure: true,
  auth: {
    user: SMTP_SERVER_USERNAME,
    pass: SMTP_SERVER_PASSWORD,
  },
});

const md = new MarkdownIt();

const {movies, downloadAll} = require('./links.json');
const dataArray = Object.keys(movies).map(movie => {
  return {
    movie,
    downloadURL: movies[movie],
    movieInfo: getMovieInfo(movie)
  };
});

function getMovieInfo(movie) {
  const info = fs.readFileSync(`../FanMixes/${movie}/README.md`, 'utf8');
  console.log(info);
  return info;
}

async function processTemplate(templatePath, outputDir, dataArray) {
  try {
    // Read the template file
    const template = fs.readFileSync(templatePath, 'utf8');
    
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Process each object in the array
    for (const data of dataArray) {
      const index = dataArray.indexOf(data);
      let processedContent = template;

      data['downloadAll'] = downloadAll;

      // Replace all variables in the template
      Object.keys(data).forEach(key => {
        const placeholder = new RegExp(`{{${key}}}`, 'g');
        processedContent = processedContent.replace(placeholder, data[key]);
      });

      // Generate output filename
      // const outputFileName = `filter_${data.movie.replaceAll(/\W/g, '') || index}.xml`;
      // const outputPath = path.join(outputDir, outputFileName);

      // Write the processed file
      // fs.writeFileSync(outputPath, processedContent);
      // console.log(`Created: ${outputPath}`);
      await transporter.sendMail({
        to: 'ari@asu.edu',
        from: 'ari@asu.edu',
        subject: 'Request: ' + data.movie,
        html:  md.render(processedContent),
        text: processedContent,
      });
      console.log(`Sent email: ${data.movie}`);
    }

    console.log(`Successfully processed ${dataArray.length} files`);
    
  } catch (error) {
    console.error('Error processing template:', error.message);
  }
}

// Usage
const templatePath = './template.md';
const outputDir = './output';

processTemplate(templatePath, outputDir, dataArray);
