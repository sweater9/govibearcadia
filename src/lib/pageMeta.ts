import { useEffect } from 'react'
import { absoluteUrl } from './seo'
import { SITE_DESCRIPTION, SITE_TITLE } from '../site'

/** Sets the tab title, description and canonical link for the current page (search engines that run scripts read these). */
export function usePageMeta(title: string | null, description: string | null, path: string) {
  useEffect(() => {
    document.title = title ?? SITE_TITLE
    const set = (selector: string, attr: string, value: string) => document.head.querySelector(selector)?.setAttribute(attr, value)
    const text = description ?? SITE_DESCRIPTION
    set('meta[name="description"]', 'content', text)
    set('meta[property="og:description"]', 'content', text)
    set('meta[property="og:title"]', 'content', title ?? SITE_TITLE)
    set('link[rel="canonical"]', 'href', absoluteUrl(path))
    set('meta[property="og:url"]', 'content', absoluteUrl(path))
  }, [title, description, path])
}
