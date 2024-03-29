import escape from 'lodash.escape';
import JSZip from 'jszip';
import FileSaver from 'file-saver';

const CELL_TYPE_STRING = 'string';
const CELL_TYPE_NUMBER = 'number';
const validTypes = [CELL_TYPE_STRING, CELL_TYPE_NUMBER];

const MISSING_KEY_FILENAME = 'Zipclex config missing property filename';
const INVALID_TYPE_FILENAME = 'Zipclex filename can only be of type string';
const INVALID_TYPE_SHEET = 'Zipcelx sheet data is not of type array';
const INVALID_TYPE_SHEET_DATA = 'Zipclex sheet data childs is not of type array';

const WARNING_INVALID_TYPE = 'Invalid type supplied in cell config, falling back to "string"';

const childValidator = (array) => {
  return array.every(item => Array.isArray(item));
};

var validator = (config) => {
  if (!config.filename) {
    console.error(MISSING_KEY_FILENAME);
    return false;
  }

  if (typeof config.filename !== 'string') {
    console.error(INVALID_TYPE_FILENAME);
    return false;
  }

  if (!Array.isArray(config.sheet.data)) {
    console.error(INVALID_TYPE_SHEET);
    return false;
  }

  if (!childValidator(config.sheet.data)) {
    console.error(INVALID_TYPE_SHEET_DATA);
    return false;
  }

  return true;
};

const generateColumnLetter = (colIndex) => {
  if (typeof colIndex !== 'number') {
    return '';
  }

  const prefix = Math.floor(colIndex / 26);
  const letter = String.fromCharCode(97 + (colIndex % 26)).toUpperCase();
  if (prefix === 0) {
    return letter;
  }
  return generateColumnLetter(prefix - 1) + letter;
};

var generatorCellNumber = (index, rowNumber) => (
  `${generateColumnLetter(index)}${rowNumber}`
);

var generatorStringCell = (index, value, rowIndex, style) => {
  let cell = `<c r="${generatorCellNumber(index, rowIndex)}"`;

  if (style) {
    cell += ` s="${style}"`;
  }

  cell += ` t="inlineStr"><is><t>${escape(value)}</t></is></c>`;

  return cell;
};

var generatorNumberCell = (index, value, rowIndex, style) => {
  let cell = `<c r="${generatorCellNumber(index, rowIndex)}"`;

  if (style) {
    cell += ` s="${style}"`;
  }

  cell += `><v>${value}</v></c>`;

  return cell;
};

var formatCell = (cell, index, rowIndex, styles) => { // eslint-disable-line
  if (validTypes.indexOf(cell.type) === -1) {
    console.warn(WARNING_INVALID_TYPE);
    cell.type = CELL_TYPE_STRING;
  }

  // let styleIndex = null;

  // if (cell.style && styles !== undefined) {
  //   styleIndex = styles.indexOf(cell.style);
  //
  //   if (styleIndex === -1) {
  //     styles.push(cell.style);
  //     styleIndex = 1;
  //   } else if (styleIndex === 0) {
  //     styleIndex = 1;
  //   }
  // }

  return (
    cell.type === CELL_TYPE_STRING
    ? generatorStringCell(index, cell.value, rowIndex, cell.style ? cell.style.toString() : '')
    : generatorNumberCell(index, cell.value, rowIndex, cell.style ? cell.style.toString() : '')
  );
};

var formatRow = (row, index, styles) => {
  // To ensure the row number starts as in excel.
  const rowIndex = index + 1;
  const rowCells = row
  .map((cell, cellIndex) => formatCell(cell, cellIndex, rowIndex, styles))
  .join('');

  return `<row r="${rowIndex}">${rowCells}</row>`;
};

var generatorRows = (rows, styles) => (
  rows
  .map((row, index) => formatRow(row, index, styles))
  .join('')
);

var workbookXML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:mx="http://schemas.microsoft.com/office/mac/excel/2008/main" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:mv="urn:schemas-microsoft-com:mac:vml" xmlns:x14="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main" xmlns:x14ac="http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac" xmlns:xm="http://schemas.microsoft.com/office/excel/2006/main"><workbookPr/><sheets><sheet state="visible" name="Sheet1" sheetId="1" r:id="rId3"/></sheets><definedNames/><calcPr/></workbook>`;

var workbookXMLRels = `<?xml version="1.0" ?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId3" Target="worksheets/sheet1.xml" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"/>
<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml" />
</Relationships>`;

var rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

var contentTypes = `<?xml version="1.0" ?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default ContentType="application/xml" Extension="xml"/>
<Default ContentType="application/vnd.openxmlformats-package.relationships+xml" Extension="rels"/>
<Override ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml" PartName="/xl/worksheets/sheet1.xml"/>
<Override ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml" PartName="/xl/workbook.xml"/>
<Override ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml" PartName="/xl/styles.xml"/>
</Types>`;

var templateSheet = `<?xml version="1.0" ?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:mv="urn:schemas-microsoft-com:mac:vml" xmlns:mx="http://schemas.microsoft.com/office/mac/excel/2008/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:x14="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main" xmlns:x14ac="http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac" xmlns:xm="http://schemas.microsoft.com/office/excel/2006/main"><sheetData>{placeholder}</sheetData></worksheet>`;

var styleTemplate = `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:x14ac="http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac">{placeholder}</styleSheet>`;

var styleInnerTemplate = `
<fonts count="1" x14ac:knownFonts="1">
    <font>
        <sz val="11"/>
        <color theme="1"/>
        <name val="Calibri"/>
        <family val="2"/>
        <scheme val="minor"/>
    </font>
</fonts>
<fills count="2">
    <fill>
        <patternFill patternType="none"/>
    </fill>
    <fill>
        <patternFill patternType="gray125"/>
    </fill>
</fills>
<borders count="1">
    <border>
        <left/>
        <right/>
        <top/>
        <bottom/>
        <diagonal/>
    </border>
</borders>
<cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
</cellStyleXfs>
<cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1">
        <alignment wrapText="1"/>
    </xf>
</cellXfs>
<cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
</cellStyles>
<dxfs count="0"/>
<tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>
<extLst>
    <ext uri="{EB79DEF2-80B8-43e5-95BD-54CBDDF9020C}"
         xmlns:x14="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main">
        <x14:slicerStyles defaultSlicerStyle="SlicerStyleLight1"/>
    </ext>
    <ext uri="{9260A510-F301-46a8-8635-F512D64BE5F5}"
         xmlns:x15="http://schemas.microsoft.com/office/spreadsheetml/2010/11/main">
        <x15:timelineStyles defaultTimelineStyle="TimeSlicerStyleLight1"/>
    </ext>
</extLst>`;

const generateXMLWorksheet = (rows, styles) => {
  const XMLRows = generatorRows(rows, styles);
  return templateSheet.replace('{placeholder}', XMLRows);
};

var zipcelx = (config) => {
  if (!validator(config)) {
    throw new Error('Validation failed.');
  }

  const zip = new JSZip();
  const xl = zip.folder('xl');
  xl.file('workbook.xml', workbookXML);
  xl.file('_rels/workbook.xml.rels', workbookXMLRels);
  zip.file('_rels/.rels', rels);
  zip.file('[Content_Types].xml', contentTypes);

  const styles = [];

  const worksheet = generateXMLWorksheet(config.sheet.data, styles);
  xl.file('worksheets/sheet1.xml', worksheet);

  // if (styles.length === 0) {
  //   const styleFile = styleTemplate.replace('{placeholder}', defaultStyles);
  //   xl.file('styles.xml', styleFile);
  // } else {
    // expand this if more than fill is needed

  const backgroundFills = [];

  for (let i = 0; i < styles.length; i++) {
    if (styles[i].indexOf('bgColor=') > -1) {
      const openingQuoteIndex = styles[i].indexOf('"', styles[i].indexOf('bgColor='));
      const closingQuoteIndex = styles[i].indexOf('"', openingQuoteIndex + 1);

      const fill = styles[i].substring(openingQuoteIndex + 1, closingQuoteIndex);
      backgroundFills.push(fill);
    }
  }

  let fillsString = `<fills count="${backgroundFills.length + 2}"><fill /><fill><patternFill patternType="gray125"/></fill>`;
  // let cellXfsString = `<cellXfs count="${backgroundFills.length + 1}"><xf />`;
  // let colorsString = '<colors><indexedColors>';

  for (let i = 0; i < backgroundFills.length; i++) {
    fillsString += `<fill><patternFill patternType="solid"><fgColor indexed="${i}"/></patternFill></fill>`;
    // colorsString += `<rgbColor rgb="${backgroundFills[i]}"/>`;
    // cellXfsString += `<xf fillId="${i + 2}" applyFill="1"/>`;
  }

  fillsString += '</fills>';
  // cellXfsString += '</cellXfs>';
  // colorsString += '</indexedColors></colors>';

  const styleData = styleInnerTemplate.replace('{fillsPlaceholder}', fillsString);
  // styleData = styleData.replace('{xfsPlaceholder}', cellXfsString + colorsString);

  const styleFile = styleTemplate.replace('{placeholder}', styleData);
  xl.file('styles.xml', styleFile);
  // }

  return zip.generateAsync({
    type: 'blob',
    mimeType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  }).then((blob) => {
    FileSaver.saveAs(blob, `${config.filename}.xlsx`);
  });
};

export default zipcelx;
export { generateXMLWorksheet };
