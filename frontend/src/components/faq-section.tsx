import { useState } from 'react'

type FaqItem = {
  q: string
  a: string
}

const FAQS: FaqItem[] = [
  {
    q: 'Do I need any technical skills to use this?',
    a: 'None at all. If you can type your business name into a search bar, you can use Visaion. Enter your business, pick a few queries your customers might ask, and we handle the rest.',
  },
  {
    q: 'What exactly does the scan do?',
    a: 'We ask AI platforms like ChatGPT, Claude, and Perplexity the same questions your customers are asking — "best plumber in Denver," "top coffee shop near me," etc. Then we check whether your business shows up in the answers, where you rank, and how you\'re described.',
  },
  {
    q: 'What if my business doesn\'t show up at all?',
    a: 'That\'s actually the most common result — and the most valuable one to know about. Your report will include specific recommendations to improve your visibility, like optimizing your Google Business Profile or getting listed on directories that AI models pull from.',
  },
  {
    q: 'Is the free scan really free?',
    a: 'Yes. No credit card, no hidden trial, no "enter your payment info just in case." You get a real scan with real results. Paid plans unlock more platforms, more queries, and on-demand rescans whenever you want them.',
  },
  {
    q: 'How is this different from traditional SEO tools?',
    a: 'SEO tools track how you rank on Google search results. Visaion tracks how you appear in AI-generated answers — a completely different channel. When someone asks ChatGPT for a recommendation, Google rankings don\'t apply. We monitor that new layer.',
  },
  {
    q: 'How often should I run a scan?',
    a: 'AI answers change constantly as models get updated and retrained. We recommend scanning at least weekly to catch shifts early. Paid plans let you re-run scans on demand whenever you publish new content or launch a campaign.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. No contracts, no cancellation fees. You can upgrade, downgrade, or cancel from your dashboard whenever you want.',
  },
]

function FaqRow({ item, open, onToggle }: { item: FaqItem; open: boolean; onToggle: () => void }) {
  return (
    <div className={`faq-row${open ? ' faq-row-open' : ''}`}>
      <button className="faq-question" onClick={onToggle} aria-expanded={open}>
        <span>{item.q}</span>
        <svg
          className="faq-chevron"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <div className="faq-answer-wrap" style={{ gridTemplateRows: open ? '1fr' : '0fr' }}>
        <div className="faq-answer-inner">
          <p className="faq-answer">{item.a}</p>
        </div>
      </div>
    </div>
  )
}

export function FaqSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(null)

  return (
    <section className="faq-section">
      <div className="container">
        <div className="faq-header reveal">
          <span className="faq-eyebrow">FAQ</span>
          <h2 className="faq-title">Questions you're probably asking.</h2>
        </div>

        <div className="faq-list reveal">
          {FAQS.map((item, i) => (
            <FaqRow
              key={i}
              item={item}
              open={openIdx === i}
              onToggle={() => setOpenIdx(openIdx === i ? null : i)}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
