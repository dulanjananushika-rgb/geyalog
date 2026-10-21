import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

export async function exportAndSharePdf(html: string, title: string = 'Document') {
  try {
    const { uri } = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
        dialogTitle: `${title}.pdf`,
      });
    } else {
      await Print.printAsync({ uri });
    }
  } catch (error) {
    Alert.alert('PDF Export Error', (error as Error).message || 'PDF generate karanna bari una.');
  }
}

export async function printDirect(html: string) {
  try {
    await Print.printAsync({ html });
  } catch (error) {
    Alert.alert('Print Error', (error as Error).message || 'Print karanna bari una.');
  }
}
