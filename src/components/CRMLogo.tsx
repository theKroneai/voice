interface CRMLogoProps {
  crmType: string
  logoUrl?: string | null
  logoEmoji?: string | null
  size?: number
}

export const CRMLogo = ({
  crmType,
  logoUrl,
  logoEmoji,
  size = 40,
}: CRMLogoProps) => {
  const token = import.meta.env.VITE_LOGODEV_TOKEN

  const dominios: Record<string, string> = {
    bitrix24: 'bitrix24.com',
    hubspot: 'hubspot.com',
    gohighlevel: 'gohighlevel.com',
    zoho: 'zoho.com',
    salesforce: 'salesforce.com',
    pipedrive: 'pipedrive.com',
    monday: 'monday.com',
  }

  const url =
    logoUrl ||
    (dominios[crmType]
      ? `https://img.logo.dev/${dominios[crmType]}?token=${token}&size=${size * 2}`
      : null)

  if (!url) {
    return (
      <span style={{ fontSize: size * 0.8 }}>
        {logoEmoji || '🔧'}
      </span>
    )
  }

  return (
    <img
      src={url}
      alt={crmType}
      width={size}
      height={size}
      className="object-contain rounded"
      onError={(e) => {
        const parent = e.currentTarget.parentElement
        if (parent) {
          e.currentTarget.remove()
          parent.innerHTML = logoEmoji || '🔧'
        }
      }}
    />
  )
}

