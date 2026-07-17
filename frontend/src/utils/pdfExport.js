import jsPDF from 'jspdf'

const MARGIN = 15
const PAGE_WIDTH = 210 // A4 mm
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const LINE_HEIGHT = 6

function newDoc() {
  return new jsPDF({ unit: 'mm', format: 'a4' })
}

/**
 * Writes wrapped text starting at the given y position, adding new pages as
 * needed. Returns the y position after the text.
 */
function writeWrapped(doc, text, y, { fontSize = 11, style = 'normal' } = {}) {
  doc.setFont('helvetica', style)
  doc.setFontSize(fontSize)
  const lines = doc.splitTextToSize(text, CONTENT_WIDTH)
  for (const line of lines) {
    if (y > 280) {
      doc.addPage()
      y = MARGIN
    }
    doc.text(line, MARGIN, y)
    y += LINE_HEIGHT
  }
  return y
}

// Strips the most common Markdown syntax so notes read reasonably as plain
// text in a PDF -- this isn't a full Markdown renderer, just enough to avoid
// literal #, **, and - characters cluttering the page.
function stripMarkdown(markdown) {
  return markdown
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/^[-*]\s+/gm, '\u2022 ')
}

export function exportNotesToPdf(title, markdown) {
  const doc = newDoc()
  let y = MARGIN
  y = writeWrapped(doc, title, y, { fontSize: 16, style: 'bold' })
  y += 2
  y = writeWrapped(doc, stripMarkdown(markdown), y)
  doc.save(`${title.replace(/[^\w-]+/g, '_')}.pdf`)
}

export function exportQuizResultsToPdf(quiz, answers, score) {
  const doc = newDoc()
  let y = MARGIN
  y = writeWrapped(doc, `Quiz: ${quiz.subject} \u2014 ${quiz.topic}`, y, { fontSize: 16, style: 'bold' })
  y = writeWrapped(doc, `Difficulty: ${quiz.difficulty}  |  Score: ${score}/${quiz.questions.length}`, y, { fontSize: 11 })
  y += 4

  quiz.questions.forEach((q, i) => {
    y = writeWrapped(doc, `${i + 1}. ${q.question}`, y, { fontSize: 12, style: 'bold' })
    q.options.forEach((option, optIndex) => {
      const isCorrect = optIndex === q.correct_index
      const isYourAnswer = optIndex === answers[i]
      let marker = '   '
      if (isCorrect) marker = ' * '
      else if (isYourAnswer) marker = ' x '
      y = writeWrapped(doc, `${marker}${option}`, y, { fontSize: 10.5 })
    })
    if (q.explanation) {
      y = writeWrapped(doc, `Explanation: ${q.explanation}`, y, { fontSize: 10, style: 'italic' })
    }
    y += 3
  })

  doc.save(`Quiz_${quiz.subject.replace(/[^\w-]+/g, '_')}.pdf`)
}

export function exportStudyPlanToPdf(plan) {
  const doc = newDoc()
  let y = MARGIN
  y = writeWrapped(doc, `Study Plan: ${plan.subjects.join(', ')}`, y, { fontSize: 16, style: 'bold' })
  y = writeWrapped(doc, `Exam date: ${plan.exam_date}`, y, { fontSize: 11 })
  y += 2
  y = writeWrapped(doc, plan.summary, y, { fontSize: 10.5, style: 'italic' })
  y += 4

  plan.days.forEach((day) => {
    y = writeWrapped(doc, day.date, y, { fontSize: 12, style: 'bold' })
    if (day.sessions.length === 0) {
      y = writeWrapped(doc, 'Rest day', y, { fontSize: 10.5, style: 'italic' })
    } else {
      day.sessions.forEach((s) => {
        y = writeWrapped(doc, `\u2022 ${s.subject} (${s.hours}h): ${s.focus}`, y, { fontSize: 10.5 })
      })
    }
    y += 2
  })

  doc.save(`StudyPlan_${plan.subjects[0].replace(/[^\w-]+/g, '_')}.pdf`)
}
