import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { processExcelWorkbook } from '@/lib/excel/processor'

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

    const buffer = Buffer.from(await file.arrayBuffer())

    // Upload to Supabase Storage
    const filePath = `${user.id}/current.xlsx`
    await supabase.storage.from('excel-files').upload(filePath, buffer, {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      upsert: true,
    })

    // Process the workbook — extract all data and store in Supabase
    const result = await processExcelWorkbook(user.id, buffer)

    return NextResponse.json({
      success: true,
      message: `Successfully imported ${result.participantCount} participants for ${result.companyName}.`,
      ...result,
    })
  } catch (error: any) {
    console.error('Excel upload error:', error)
    return NextResponse.json({
      success: false,
      message: error.message || 'Upload failed. Please check your file format and try again.',
    }, { status: 500 })
  }
}
