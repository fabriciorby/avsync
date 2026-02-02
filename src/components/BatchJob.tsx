import { useState } from 'react'
import './BatchJob.css'

export interface BatchJobItem {
  id: string
  refVideo: string
  foreignVideo: string
  outputVideo: string
  firstSegmentAdjust: number
  lastSegmentAdjust: number
  skipSubtitles: boolean
  status: 'pending' | 'processing' | 'completed' | 'failed'
}

interface BatchJobProps {
  parameters: any
  onAddToQueue: (jobs: BatchJobItem[]) => void
  onJobsChange?: (jobs: BatchJobItem[]) => void
  onEditingIdChange?: (id: string | null) => void
}

const DEFAULT_PATTERNS = [
  '\\.[^.]+$',
  '\\[.*?\\]',
  '(1080p|720p|4k)',
  '(ptbr|eng|jap|jp)',
  '[-_.\\s]'
]

const buildMatchKey = (filename: string, patterns: RegExp[]) => {
  let key = filename.toLowerCase()
  for (const p of patterns) key = key.replace(p, '')
  return key.trim()
}

export default function BatchJob({ parameters, onAddToQueue, onJobsChange }: BatchJobProps) {
  const [refFolder, setRefFolder] = useState('')
  const [foreignFolder, setForeignFolder] = useState('')
  const [outputFolder, setOutputFolder] = useState('')
  const [jobs, setJobs] = useState<BatchJobItem[]>([])
  const [patterns, setPatterns] = useState<string[]>(DEFAULT_PATTERNS)
  const [preview, setPreview] = useState<any[]>([])

  const handleSelectFolder = async (type: 'ref' | 'foreign' | 'output') => {
    const path = await window.electronAPI.selectDirectory()
    if (!path) return

    if (type === 'ref') setRefFolder(path)
    else if (type === 'foreign') setForeignFolder(path)
    else setOutputFolder(path)
  }

  const handleLoadJobs = async () => {
    if (!refFolder || !foreignFolder || !outputFolder) {
      alert('Please select all three folders')
      return
    }

    try {
      const refFiles = await window.electronAPI.listDirectory(refFolder)
      const foreignFiles = await window.electronAPI.listDirectory(foreignFolder)

      const videoExtensions = ['.mkv', '.mp4', '.avi', '.mov', '.m4v']
      const refVideos = refFiles.filter(f =>
        videoExtensions.some(ext => f.toLowerCase().endsWith(ext))
      )
      const foreignVideos = foreignFiles.filter(f =>
        videoExtensions.some(ext => f.toLowerCase().endsWith(ext))
      )

      const regexes = patterns
        .filter(Boolean)
        .map(p => new RegExp(p, 'gi'))

      const foreignMap = new Map<string, string>()
      for (const f of foreignVideos) {
        foreignMap.set(buildMatchKey(f, regexes), f)
      }

      const matched: BatchJobItem[] = []
      const previewRows: any[] = []

      for (const r of refVideos) {
        const key = buildMatchKey(r, regexes)
        const match = foreignMap.get(key)

        previewRows.push({
          ref: r,
          foreign: match || null,
          key
        })

        if (match) {
          matched.push({
            id: `batch-${Date.now()}-${Math.random()}`,
            refVideo: `${refFolder}/${r}`,
            foreignVideo: `${foreignFolder}/${match}`,
            outputVideo: `${outputFolder}/${r}`,
            firstSegmentAdjust: parameters.firstSegmentAdjust || 0,
            lastSegmentAdjust: parameters.lastSegmentAdjust || 0,
            skipSubtitles: parameters.noSubtitles || false,
            status: 'pending'
          })
        }
      }

      setPreview(previewRows)
      setJobs(matched)
      onJobsChange?.(matched)
    } catch (err) {
      console.error(err)
      alert('Failed to load directory contents')
    }
  }

  const handleAddToQueue = () => {
    if (jobs.length === 0) return
    onAddToQueue(jobs)
    setJobs([])
    setPreview([])
    onJobsChange?.([])
  }

  return (
    <div className="batch-job">
      {/* ================= Folder Selection (IGUAL AO ORIGINAL) ================= */}
      <div className="batch-folders">
        <h2 className="section-title">
          Folder Selection
        </h2>

        <div className="folder-inputs">
          <div className="folder-item">
            <label className="folder-label">Reference Folder</label>
            <div className="folder-input-group">
              <input
                type="text"
                value={refFolder}
                readOnly
                placeholder="No folder selected"
                className="folder-input"
              />
              <button className="btn-browse" onClick={() => handleSelectFolder('ref')}>
                Browse
              </button>
            </div>
          </div>

          <div className="folder-item">
            <label className="folder-label">Foreign Folder</label>
            <div className="folder-input-group">
              <input
                type="text"
                value={foreignFolder}
                readOnly
                placeholder="No folder selected"
                className="folder-input"
              />
              <button className="btn-browse" onClick={() => handleSelectFolder('foreign')}>
                Browse
              </button>
            </div>
          </div>

          <div className="folder-item">
            <label className="folder-label">Output Folder</label>
            <div className="folder-input-group">
              <input
                type="text"
                value={outputFolder}
                readOnly
                placeholder="No folder selected"
                className="folder-input"
              />
              <button className="btn-browse" onClick={() => handleSelectFolder('output')}>
                Browse
              </button>
            </div>
          </div>
        </div>

        <button
          className="btn-load-jobs"
          onClick={handleLoadJobs}
          disabled={!refFolder || !foreignFolder || !outputFolder}
        >
          Load / Preview Matches
        </button>
              {/* ================= Regex Editor ================= */}
      <div className="folder-item">
        <h3 className="section-title">Match Rules (Regex)</h3>

        {patterns.map((p, i) => (
          <input
            key={i}
            value={p}
            onChange={e => {
              const copy = [...patterns]
              copy[i] = e.target.value
              setPatterns(copy)
            }}
            className="folder-input"
          />
        ))}

        <button className="btn-browse" onClick={() => setPatterns([...patterns, ''])}>
          + Add Regex
        </button>
      </div>

      </div>


      {/* ================= Preview ================= */}
      {preview.length > 0 && (
        <div className="preview">
          <h3>Preview</h3>
          <table className="preview-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Foreign</th>
                <th>Match Key</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((p, i) => (
                <tr key={i} className={!p.foreign ? 'no-match' : ''}>
                  <td>{p.ref}</td>
                  <td>{p.foreign || '❌ No match'}</td>
                  <td>{p.key}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {jobs.length > 0 && (
        <button className="btn-add-to-queue-bottom" onClick={handleAddToQueue}>
          Add {jobs.length} Job{jobs.length !== 1 ? 's' : ''} to Queue
        </button>
      )}
    </div>
  )
}
