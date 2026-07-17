import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Download } from 'lucide-react'
import Modal from './ui/Modal.jsx'
import Button from './ui/Button.jsx'
import { exportNotesToPdf } from '../utils/pdfExport.js'

export default function NotesViewer({ notes, onClose }) {
  return (
    <Modal
      title="Study Notes"
      onClose={onClose}
      footer={
        <Button size="sm" onClick={() => exportNotesToPdf('Study Notes', notes)}>
          <Download size={14} /> Download PDF
        </Button>
      }
    >
      <div className="markdown-body notes-body">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{notes}</ReactMarkdown>
      </div>
    </Modal>
  )
}
