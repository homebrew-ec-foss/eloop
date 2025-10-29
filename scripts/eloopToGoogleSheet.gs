// ===== Load Environment Variables from Script Properties =====
const props = PropertiesService.getScriptProperties();
const NEXTAUTH_URL = props.getProperty('NEXTAUTH_URL');
const CSV_EXPORT_KEY = props.getProperty('CSV_EXPORT_KEY');
const EVENT_ID = props.getProperty('EVENT_ID');
const SHEET_NAME_CHECKPOINT = props.getProperty('SHEET_NAME_CHECKPOINT');
const SHEET_NAME_REGS = props.getProperty('SHEET_NAME_REGS');

// ===== Main Function =====
function importCSVFromEloop() {
  try {
    // Build the URL dynamically
    const checkpointUrl = `${NEXTAUTH_URL}/api/admin/export/checkpoint?event_id=${EVENT_ID}&key=${CSV_EXPORT_KEY}`;
    const regsUrl = `${NEXTAUTH_URL}/api/admin/export/table?table=registrations&key=${CSV_EXPORT_KEY}`;
    
    // Fetch CSV content for checkpoints
    const csvContent = UrlFetchApp.fetch(checkpointUrl).getContentText();
    const csvData = Utilities.parseCsv(csvContent);

    // Get or create the sheet for checkpoints
    let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME_CHECKPOINT);
    if (!sheet) {
      sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(SHEET_NAME_CHECKPOINT);
    }

    // Clear existing content and write CSV data
    sheet.clearContents();
    sheet.getRange(1, 1, csvData.length, csvData[0].length).setValues(csvData);

    Logger.log(`CHECKPOINTs imported successfully at ${new Date()}`);

    // Fetch and write registrations CSV to a separate sheet
    const regsContent = UrlFetchApp.fetch(regsUrl).getContentText();
    const regsData = Utilities.parseCsv(regsContent);

    let regsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME_REGS);
    if (!regsSheet) {
      regsSheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(SHEET_NAME_REGS);
    }

    regsSheet.clearContents();
    regsSheet.getRange(1, 1, regsData.length, regsData[0].length).setValues(regsData);

    Logger.log(`REGISTRATIONS imported successfully at ${new Date()}`);
  } catch (e) {
    Logger.log(`Error importing CSV: ${e}`);
  }
}
