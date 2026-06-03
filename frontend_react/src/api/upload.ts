import { api } from './client'

export interface UploadTicketImageResponse {
  url: string
}

export function uploadTicketImage(file: File | Blob, filename?: string): Promise<UploadTicketImageResponse> {
  const formData = new FormData()
  const name = filename ?? (file instanceof File ? file.name : 'image.jpg')
  formData.append('file', file, name)
  return api
    .post<UploadTicketImageResponse>('/upload/ticket-image', formData, {
      headers: {
        'Content-Type': undefined as unknown as string,
      },
      timeout: 15000,
    })
    .then((res) => res.data)
}
