interface Props {
  webUrl: string
  accentColor: string
}

// A plain link to the bank's homepage. On mobile, if the bank's app supports
// Apple/Google Universal Links and is installed, the OS opens the app
// automatically — no custom URL scheme guessing needed.
export function PayCardButton({ webUrl, accentColor }: Props) {
  return (
    <a
      href={webUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1 block w-full rounded-lg py-2 text-center text-sm font-medium text-white transition-opacity hover:opacity-90 active:opacity-75"
      style={{ backgroundColor: accentColor }}
    >
      Pay this card →
    </a>
  )
}
