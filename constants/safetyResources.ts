export interface EmergencyResource {
  police: string
  crisis?: string
  crisisName?: string
}

export const EMERGENCY_NUMBERS: Record<string, EmergencyResource> = {
  Malaysia: {
    police: '999',
    crisis: '15999',
    crisisName: 'Talian Kasih (Women & Children)',
  },
  Singapore: {
    police: '999',
    crisis: '6779 0282',
    crisisName: 'AWARE Sexual Assault Care Centre',
  },
  Thailand: {
    police: '1155',
    crisis: '02-513-1001',
    crisisName: 'Women and Men Progressive Movement',
  },
  Philippines: {
    police: '911',
    crisis: '1343',
    crisisName: 'DSWD Action Center',
  },
  Indonesia: {
    police: '110',
    crisis: '119',
    crisisName: 'Emergency Hotline',
  },
  Vietnam: {
    police: '113',
    crisis: '18001567',
    crisisName: 'National Domestic Violence Hotline',
  },
}

export const FALLBACK_COUNTRY = 'Malaysia'
