import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// サウンドファイルの拡張子
const SOUND_FILE_EXTENSIONS = ['.mp3', '.wav', '.ogg'];

export async function GET() {
  try {
    // public/soundsディレクトリの絶対パスを取得
    const soundsDir = path.join(process.cwd(), 'public', 'sounds');
    
    // ディレクトリが存在するか確認
    if (!fs.existsSync(soundsDir)) {
      return NextResponse.json({ error: 'サウンドディレクトリが見つかりません' }, { status: 404 });
    }
    
    // soundsディレクトリ直下のファイルのみを取得（サブディレクトリは検索しない）
    const items = fs.readdirSync(soundsDir, { withFileTypes: true });
    
    // ファイルのみを処理（ディレクトリは無視）
    const soundFiles = items
      .filter(item => 
        // ファイルであること、かつディレクトリ（nature, retro, default）でないこと
        item.isFile() && 
        // 拡張子が対象のものであること
        SOUND_FILE_EXTENSIONS.includes(path.extname(item.name).toLowerCase())
      )
      .map(item => item.name);
    
    // 結果を返す
    return NextResponse.json(soundFiles);
    
  } catch (error) {
    console.error('サウンドファイルの取得エラー:', error);
    return NextResponse.json({ error: 'サウンドファイルの取得中にエラーが発生しました' }, { status: 500 });
  }
} 