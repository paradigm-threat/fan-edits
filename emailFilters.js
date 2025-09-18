const fs = require('fs');
const path = require('path');

// Example array of objects with variables
const dataArray = [
  {
    name: 'John Doe',
    email: 'john.doe@example.com',
    id: '001',
    department: 'Engineering'
  },
  {
    name: 'Jane Smith',
    email: 'jane.smith@example.com',
    id: '002',
    department: 'Marketing'
  },
  {
    name: 'Bob Johnson',
    email: 'bob.johnson@example.com',
    id: '003',
    department: 'Sales'
  }
];

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
      const outputFileName = `output_${data.id || index}.xml`;
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
