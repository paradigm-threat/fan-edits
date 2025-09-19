const fs = require('fs');
const path = require('path');
const MarkdownIt = require('markdown-it');
const { encode } = require('html-entities');

const md = new MarkdownIt();

const links = require('./links.json');
const dataArray = Object.keys(links).map(movie => {
  return {
    movie,
    downloadURL: links[movie],
    movieInfo: getMovieInfo(movie)
  };
});

function getMovieInfo(movie) {
  const info = fs.readFileSync(`../FanMixes/${movie}/README.md`, 'utf8');
  const html = md.render(info);
  console.log(html);
  return encode(html);
}

function processTemplate(templatePath, outputDir, dataArray) {
  try {
    // Read the template file
    const template = fs.readFileSync(templatePath, 'utf8');
    
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Process each object in the array
    dataArray.forEach((data, index) => {
      let processedContent = template;
      
      // Replace all variables in the template
      Object.keys(data).forEach(key => {
        const placeholder = new RegExp(`{{${key}}}`, 'g');
        processedContent = processedContent.replace(placeholder, data[key]);
      });
      
      // Generate output filename
      const outputFileName = `filter_${data.movie.replaceAll(/\W/g, '') || index}.xml`;
      const outputPath = path.join(outputDir, outputFileName);
      
      // Write the processed file
      fs.writeFileSync(outputPath, processedContent);
      console.log(`Created: ${outputPath}`);
    });
    
    console.log(`Successfully processed ${dataArray.length} files`);
    
  } catch (error) {
    console.error('Error processing template:', error.message);
  }
}

// Usage
const templatePath = './template.xml';
const outputDir = './output';

processTemplate(templatePath, outputDir, dataArray);
