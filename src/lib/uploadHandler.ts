import { writeFile, unlink } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'

ffmpeg.setFfmpegPath(ffmpegInstaller.path)

const ALLOWED_EPISODE_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm'])
const ALLOWED_AD_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'audio/mpeg',
  'audio/wav',
  'audio/mp4',
  'audio/ogg',
])
const MAX_EPISODE_BYTES = 500 * 1024 * 1024 // 500 MB
const MAX_AD_BYTES = 100 * 1024 * 1024 // 100 MB

type UploadType = 'episode' | 'ad'

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._\-]/g, '_').slice(0, 100)
}

function transcodeToMp4(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions(['-movflags faststart', '-preset fast', '-crf 23'])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run()
  })
}

export async function handleUpload(
  file: File,
  uploadType: UploadType
): Promise<{ filePath: string; originalName: string }> {
  const isEpisode = uploadType === 'episode'
  const allowedTypes = isEpisode ? ALLOWED_EPISODE_TYPES : ALLOWED_AD_TYPES
  const maxBytes = isEpisode ? MAX_EPISODE_BYTES : MAX_AD_BYTES

  if (!allowedTypes.has(file.type)) {
    throw new UploadError(
      `Unsupported file type: ${file.type}. Allowed: ${Array.from(allowedTypes).join(', ')}`,
      415
    )
  }

  if (file.size > maxBytes) {
    throw new UploadError(
      `File too large: ${(file.size / 1024 / 1024).toFixed(1)} MB. Max: ${maxBytes / 1024 / 1024} MB`,
      413
    )
  }

  const subDir = isEpisode ? 'episodes' : 'ads'
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads', subDir)

  // transcode mov for browser compat
  const needsTranscode = file.type === 'video/quicktime'

  if (needsTranscode) {
    const tempName = `${randomUUID()}-tmp-${sanitizeFilename(file.name)}`
    const finalName = `${randomUUID()}-${sanitizeFilename(file.name).replace(/\.mov$/i, '.mp4')}`
    const tempPath = path.join(uploadsDir, tempName)
    const finalPath = path.join(uploadsDir, finalName)

    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(tempPath, buffer)

    try {
      await transcodeToMp4(tempPath, finalPath)
    } finally {
      await unlink(tempPath).catch(() => {})
    }

    return {
      filePath: `/uploads/${subDir}/${finalName}`,
      originalName: file.name,
    }
  }

  const safeName = `${randomUUID()}-${sanitizeFilename(file.name)}`
  const dest = path.join(uploadsDir, safeName)

  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(dest, buffer)

  return {
    filePath: `/uploads/${subDir}/${safeName}`,
    originalName: file.name,
  }
}

export class UploadError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message)
    this.name = 'UploadError'
  }
}
