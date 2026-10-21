export const supportedLanguages = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'si', label: 'Sinhala', nativeLabel: 'සිංහල' },
  { code: 'ta', label: 'Tamil', nativeLabel: 'தமிழ்' },
] as const;

export type LanguageCode = (typeof supportedLanguages)[number]['code'];

export function getLanguageLabel(code: LanguageCode): string {
  return supportedLanguages.find(language => language.code === code)?.label ?? 'English';
}

export const translations = {
  en: {
    // General
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    back: 'Back',
    submit: 'Submit',
    search: 'Search',
    filter: 'Filter',
    loading: 'Loading...',
    retry: 'Retry',
    close: 'Close',
    share: 'Share',
    print: 'Print',
    sharePdf: 'Share PDF via WhatsApp',

    // Navigation & Headers
    projects: 'Projects',
    siteDiary: 'Daily Site Diary',
    sitePhotos: 'Site Photos & Documents',
    workforce: 'Workforce & Attendance',
    materials: 'Materials & Procurement',
    payments: 'Payments & Receipts',
    company: 'Company Profile',
    settings: 'Settings',
    signOut: 'Sign Out',

    // Site Diary
    weather: 'Weather',
    weatherSunny: 'Sunny / Clear',
    weatherCloudy: 'Cloudy / Overcast',
    weatherRainy: 'Rainy / Showers',
    weatherHeavyRain: 'Heavy Rain / Storm',
    weatherWindy: 'Windy / Adverse',
    workCompleted: 'Work Completed Summary',
    workersCount: 'Number of Active Workers',
    issuesOrDelays: 'Delays / Site Issues',
    visitors: 'Inspectors / Visitors',
    recordDiary: 'Save Diary Entry',
    diaryHistory: 'Past Site Diary Entries',
    diarySuccess: 'Daily site diary entry recorded successfully.',

    // P&L and Finance
    budgetVsActual: 'Budget vs. Actual (P&L)',
    contractValue: 'Agreed Contract Value',
    projectedProfit: 'Projected Profit',
    profitMargin: 'Profit Margin',
    totalExpenses: 'Total Expenses',
    materialsCost: 'Materials Cost',
    labourCost: 'Labour Cost',
    inflowsReceived: 'Customer Inflows Received',
    outstandingBalance: 'Outstanding Balance Due',
    netCashFlow: 'Net Cash Flow',
    profitable: 'Profitable',
    loss: 'Deficit / Over-budget',

    // Statuses
    active: 'Active',
    completed: 'Completed',
    pending: 'Pending',
    inProgress: 'In Progress',
    approved: 'Approved',
    rejected: 'Rejected',
    draft: 'Draft',
    cancelled: 'Cancelled',
  },
  si: {
    // General
    save: 'සුරකින්න',
    cancel: 'අවලංගු කරන්න',
    delete: 'මකන්න',
    back: 'ආපසු',
    submit: 'යොමු කරන්න',
    search: 'සොයන්න',
    filter: 'පෙරහන් කරන්න',
    loading: 'පූරණය වෙමින්...',
    retry: 'නැවත උත්සාහ කරන්න',
    close: 'වසන්න',
    share: 'බෙදාහරින්න',
    print: 'මුද්‍රණය කරන්න',
    sharePdf: 'WhatsApp මඟින් PDF බෙදාහරින්න',

    // Navigation & Headers
    projects: 'ව්‍යාපෘති',
    siteDiary: 'දෛනික සේවා සටහන (Site Diary)',
    sitePhotos: 'ඡායාරූප සහ ලියකියවිලි',
    workforce: 'සේවකයන් සහ පැමිණීම',
    materials: 'ද්‍රව්‍ය සහ ඇණවුම්',
    payments: 'ගෙවීම් සහ රිසිට්පත්',
    company: 'ආයතනික විස්තර',
    settings: 'සැකසුම්',
    signOut: 'පිටවන්න',

    // Site Diary
    weather: 'කාලගුණය',
    weatherSunny: 'හිරු එළිය සහිත / වියළි',
    weatherCloudy: 'වළාකුළු සහිත',
    weatherRainy: 'වැසි සහිත',
    weatherHeavyRain: 'තද වැසි / කුණාටු',
    weatherWindy: 'සුළං සහිත / අයහපත්',
    workCompleted: 'අවසන් කළ වැඩ විස්තරය',
    workersCount: 'වැඩ කළ සේවකයන් ගණන',
    issuesOrDelays: 'බාධා හෝ ප්‍රමාදයන්',
    visitors: 'පරීක්ෂකවරුන් / අමුත්තන්',
    recordDiary: 'දින සටහන සුරකින්න',
    diaryHistory: 'පසුගිය දින සටහන්',
    diarySuccess: 'දෛනික සේවා සටහන සාර්ථකව ඇතුළත් විය.',

    // P&L and Finance
    budgetVsActual: 'අයවැය සහ වියදම් ලාභාලාභ (P&L)',
    contractValue: 'එකඟ වූ කොන්ත්‍රාත් මුදල',
    projectedProfit: 'ඇස්තමේන්තුගත ලාභය',
    profitMargin: 'ලාභ ප්‍රතිශතය',
    totalExpenses: 'මුළු සැබෑ වියදම',
    materialsCost: 'ද්‍රව්‍ය වියදම්',
    labourCost: 'ශ්‍රම වියදම්',
    inflowsReceived: 'ලැබුණු මුදල් එකතුව',
    outstandingBalance: 'ලැබීමට ඇති ශේෂය',
    netCashFlow: 'ශුද්ධ මුදල් ප්‍රවාහය (Net Cash Flow)',
    profitable: 'ලාභදායී',
    loss: 'පාඩු / අයවැය ඉක්මවා යාම',

    // Statuses
    active: 'ක්‍රියාකාරී',
    completed: 'අවසන් කළ',
    pending: 'තහවුරු කිරීමට ඇති',
    inProgress: 'සිදුකෙරෙමින් පවතින',
    approved: 'අනුමත කළ',
    rejected: 'ප්‍රතික්ෂේපිත',
    draft: 'කෙටුම්පත',
    cancelled: 'අවලංගු කළ',
  },
  ta: {
    // General
    save: 'சேமிக்கவும்',
    cancel: 'ரத்துசெய்',
    delete: 'நீக்கு',
    back: 'பின்செல்க',
    submit: 'சமர்ப்பிக்கவும்',
    search: 'தேடுக',
    filter: 'வடிகட்டு',
    loading: 'ஏற்றுகிறது...',
    retry: 'மீண்டும் முயற்சி செய்க',
    close: 'மூடுக',
    share: 'பகிர்க',
    print: 'அச்சிடுக',
    sharePdf: 'WhatsApp மூலம் PDF பகிர்க',

    // Navigation & Headers
    projects: 'திட்டங்கள்',
    siteDiary: 'தினசரி தள குறிப்பேடு',
    sitePhotos: 'தள புகைப்படங்கள் & ஆவணங்கள்',
    workforce: 'தொழிலாளர்கள் & வருகை',
    materials: 'பொருட்கள் & கொள்முதல்',
    payments: 'கட்டணங்கள் & பற்றுச்சீட்டுகள்',
    company: 'நிறுவன விவரங்கள்',
    settings: 'அமைப்புகள்',
    signOut: 'வெளியேறுக',

    // Site Diary
    weather: 'வானிலை',
    weatherSunny: 'வெயில் / தெளிவான',
    weatherCloudy: 'மேகமூட்டம்',
    weatherRainy: 'மழை',
    weatherHeavyRain: 'கனமழை',
    weatherWindy: 'காற்று வீசும்',
    workCompleted: 'முடிந்த வேலை விவரம்',
    workersCount: 'பணியாற்றிய தொழிலாளர்கள் எண்ணிக்கை',
    issuesOrDelays: 'தாமதங்கள் / தள சிக்கல்கள்',
    visitors: 'பார்வையாளர்கள்',
    recordDiary: 'குறிப்பைச் சேமிக்குக',
    diaryHistory: 'முந்தைய குறிப்புகள்',
    diarySuccess: 'தள குறிப்பு வெற்றிகரமாகப் பதியப்பட்டது.',

    // P&L and Finance
    budgetVsActual: 'வரவு செலவு & லாப நட்ட கணக்கு',
    contractValue: 'ஒப்பந்த மதிப்பு',
    projectedProfit: 'எதிர்பார்க்கப்படும் லாபம்',
    profitMargin: 'லாப வரம்பு',
    totalExpenses: 'மொத்த செலவுகள்',
    materialsCost: 'பொருட்கள் செலவு',
    labourCost: 'ஊழியர் கூலி செலவு',
    inflowsReceived: 'பெறப்பட்ட தொகை',
    outstandingBalance: 'நிலுவைத் தொகை',
    netCashFlow: 'நிகர பணப்புழக்கம்',
    profitable: 'லாபகரமானது',
    loss: 'பற்றாக்குறை / இழப்பு',

    // Statuses
    active: 'செயலில் உள்ளது',
    completed: 'நிறைவடைந்தது',
    pending: 'நிலுவையில் உள்ளது',
    inProgress: 'நடைபெறுகிறது',
    approved: 'அங்கீகரிக்கப்பட்டது',
    rejected: 'நிராகரிக்கப்பட்டது',
    draft: 'வரைவு',
    cancelled: 'ரத்து செய்யப்பட்டது',
  },
} as const;

export type TranslationKey = keyof typeof translations.en;

export function t(key: TranslationKey, lang: LanguageCode = 'en'): string {
  const dictionary = translations[lang] || translations.en;
  return (dictionary as Record<string, string>)[key] ?? translations.en[key] ?? key;
}
