import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ success: false, message: 'No file provided' }, { status: 400 })
    }

    if (!file.name.endsWith('.xlsx')) {
      return NextResponse.json({ success: false, message: 'Only .xlsx files are supported' }, { status: 400 })
    }

    // Upload to Supabase Storage
    const buffer = Buffer.from(await file.arrayBuffer())
    const filePath = `${user.id}/current.xlsx`

    const { error: uploadError } = await supabase.storage
      .from('excel-files')
      .upload(filePath, buffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        upsert: true
      })

    if (uploadError) {
      return NextResponse.json({ success: false, message: 'Failed to upload file: ' + uploadError.message }, { status: 500 })
    }

    // Update last_updated_at on profile
    await supabase.from('profiles').update({
      last_updated_at: new Date().toISOString()
    }).eq('id', user.id)

    // TODO: Phase 3 - Process Excel with ExcelJS, inject formulas, extract computed values
    // TODO: Parse worksheets and populate analytical tables

    return NextResponse.json({
      success: true,
      message: 'File uploaded successfully. Data processing will be available soon.',
      file: { name: file.name, size: file.size }
    })
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Upload failed. Please try again.' }, { status: 500 })
  }
}
