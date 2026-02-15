type MeetingLinkProps = {
  url: string | null | undefined
}

export function MeetingLink({ url }: MeetingLinkProps) {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) {
    return null
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-indigo-600 hover:text-indigo-800 hover:underline"
    >
      Open Meeting
    </a>
  )
}
