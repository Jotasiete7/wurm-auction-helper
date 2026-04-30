import { useLanguage } from '../i18n/LanguageContext'
import { Language } from '../i18n/translations'

const languages: { code: Language; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'pt', label: 'PT' },
]

export function LanguageSelector() {
  const { language, setLanguage } = useLanguage()

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-1 text-sm bg-wurm-panel/80 backdrop-blur-sm border border-wurm-border rounded-lg px-2 py-1">
      {languages.map((lang, index) => (
        <span key={lang.code} className="flex items-center">
          <button
            type="button"
            onClick={() => setLanguage(lang.code)}
            className={`
              px-2 py-1 rounded transition-colors
              ${language === lang.code
                ? 'text-wurm-accent font-medium'
                : 'text-wurm-muted hover:text-wurm-text'
              }
            `}
          >
            {lang.label}
          </button>
          {index < languages.length - 1 && (
            <span className="text-wurm-border">|</span>
          )}
        </span>
      ))}
    </div>
  )
}
