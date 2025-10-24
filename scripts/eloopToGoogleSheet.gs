// ===== Load Environment Variables from Script Properties =====
const props = PropertiesService.getScriptProperties();
const NEXTAUTH_URL = props.getProperty('NEXTAUTH_URL');
const CSV_EXPORT_KEY = props.getProperty('CSV_EXPORT_KEY');
const EVENT_ID = props.getProperty('EVENT_ID');
const SHEET_NAME = props.getProperty('SHEET_NAME');

// ===== Main Function =====
function importCSVFromEloop() {
  try {
    // Build the URL dynamically
    const csvUrl = `${NEXTAUTH_URL}/api/admin/export/checkpoint?event_id=${EVENT_ID}&key=${CSV_EXPORT_KEY}`;

    // Fetch CSV content
    const csvContent = UrlFetchApp.fetch(csvUrl).getContentText();
    const csvData = Utilities.parseCsv(csvContent);

    // Get or create the sheet
    let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(SHEET_NAME);
    }

    // Clear existing content
    sheet.clearContents();

    // Write CSV data
    sheet.getRange(1, 1, csvData.length, csvData[0].length).setValues(csvData);

    Logger.log(`CSV imported successfully at ${new Date()}`);
  } catch (e) {
    Logger.log(`Error importing CSV: ${e}`);
  }
}
