export interface ServiceDetails {
  approximateAmount: string;
  serviceCharge: string;
  originalDocuments: string[];
  xeroxDocuments: string[];
  note: string;
}

export const SERVICE_CATALOG: Record<string, ServiceDetails> = {
  Certificates: {
    approximateAmount: '₹50',
    serviceCharge: 'As applicable',
    originalDocuments: ['Aadhaar Card', 'Relevant certificate/supporting proof', 'Applicant mobile number'],
    xeroxDocuments: ['Aadhaar Card Xerox', 'Relevant supporting document Xerox'],
    note: 'Approximate prototype amount only. Final amount depends on the certificate/service requested.',
  },
  'Municipal Services': {
    approximateAmount: '₹100–₹500',
    serviceCharge: 'As applicable',
    originalDocuments: ['Aadhaar Card', 'Address proof', 'Relevant municipal/property document'],
    xeroxDocuments: ['Aadhaar Card Xerox', 'Address proof Xerox', 'Relevant supporting document Xerox'],
    note: 'Approximate prototype amount only. Requirements vary by municipal service.',
  },
  'Electricity Services': {
    approximateAmount: '₹100–₹500',
    serviceCharge: 'As applicable',
    originalDocuments: ['Aadhaar Card', 'Electricity service/consumer number', 'Relevant connection document'],
    xeroxDocuments: ['Aadhaar Card Xerox', 'Consumer/service document Xerox', 'Relevant supporting document Xerox'],
    note: 'Approximate prototype amount only. Final amount depends on the electricity service.',
  },
  'Other Services': {
    approximateAmount: '₹50–₹500',
    serviceCharge: 'As applicable',
    originalDocuments: ['Aadhaar Card', 'Relevant original supporting documents'],
    xeroxDocuments: ['Aadhaar Card Xerox', 'Relevant supporting document Xerox'],
    note: 'Approximate prototype amount only. Documents depend on the selected service.',
  },
  'Aadhaar Services': {
    approximateAmount: '₹50',
    serviceCharge: 'As applicable',
    originalDocuments: ['Aadhaar Card', 'Valid identity/address supporting document if required'],
    xeroxDocuments: ['Aadhaar Card Xerox', 'Supporting document Xerox if required'],
    note: 'Approximate prototype amount only. The exact requirement depends on the Aadhaar service.',
  },
  'Licence Services': {
    approximateAmount: '₹500–₹1,000',
    serviceCharge: 'As applicable',
    originalDocuments: ['Aadhaar Card', 'Age/address proof', 'Existing licence if applicable', 'Relevant supporting documents'],
    xeroxDocuments: ['Aadhaar Card Xerox', 'Age/address proof Xerox', 'Existing licence Xerox if applicable', 'Supporting document Xerox'],
    note: 'Approximate prototype amount only. Exact amount and documents depend on the licence service.',
  },
  'Application Services': {
    approximateAmount: '₹100–₹500',
    serviceCharge: 'As applicable',
    originalDocuments: ['Aadhaar Card', 'Completed application/supporting originals', 'Relevant proof documents'],
    xeroxDocuments: ['Aadhaar Card Xerox', 'Application/supporting document Xerox', 'Relevant proof Xerox'],
    note: 'Approximate prototype amount only. Exact requirements depend on the application.',
  },
};
