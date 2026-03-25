/** Icono oficial Krone (PNG en /public) para UI y marca */
export const KRONE_BRAND_ICON = '/android-chrome-192x192.png'

export const getLogoUrl = (dominio: string, size: number = 128): string => {
  const token = import.meta.env.VITE_LOGODEV_TOKEN
  return `https://img.logo.dev/${dominio}?token=${token}&size=${size}`
}

export const CRM_LOGOS: Record<string, string> = {
  bitrix24: getLogoUrl('bitrix24.com'),
  hubspot: getLogoUrl('hubspot.com'),
  gohighlevel: getLogoUrl('gohighlevel.com'),
  zoho: getLogoUrl('zoho.com'),
  salesforce: getLogoUrl('salesforce.com'),
  pipedrive: getLogoUrl('pipedrive.com'),
  monday: getLogoUrl('monday.com'),
  custom: '',
}

