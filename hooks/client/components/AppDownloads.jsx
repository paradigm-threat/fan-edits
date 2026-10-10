/**
 * Versioned Flashback APK download panel for /app (plain React — works under SSR-static).
 */
import React from 'react'

function str(v) {
  if (v === null || v === undefined) {
    return ''
  }
  return '' + v
}

export default function AppDownloads(props) {
  const p = props || {}
  const versionName = str(p.versionName)
  const versionCode = str(p.versionCode)
  const apkUrl = str(p.apkUrl) || '/downloads/flashback.apk'
  const apkArm64 = str(p.apkArm64) || '/downloads/flashback-arm64-v8a.apk'
  const apkArmv7 = str(p.apkArmv7) || '/downloads/flashback-armeabi-v7a.apk'

  let versionLine = 'Latest published build'
  if (versionName.length > 0) {
    versionLine = 'Version ' + versionName
    if (versionCode.length > 0) {
      versionLine = versionLine + ' (build ' + versionCode + ')'
    }
  }

  return (
    <section className="fb-app-downloads" aria-label="Download Flashback APK">
      <p className="fb-app-downloads-version">{versionLine}</p>
      <div className="fb-app-downloads-actions">
        <a className="fb-btn fb-btn-primary" href={apkUrl} download="">
          {'Download Flashback APK · '}
          {versionName.length > 0 ? versionName : 'universal'}
        </a>
        <a className="fb-btn" href={apkArmv7} download="">
          {'32-bit (Fire TV) · '}
          {versionName.length > 0 ? versionName : 'armeabi-v7a'}
        </a>
        <a className="fb-btn" href={apkArm64} download="">
          {'64-bit only · '}
          {versionName.length > 0 ? versionName : 'arm64-v8a'}
        </a>
      </div>
      <p className="fb-theater-downloads-note">
        {
          'Universal is fine for most phones. Use 32-bit on Amazon Fire TV / older Android TV if install fails. 64-bit is a smaller phone build.'
        }
      </p>
    </section>
  )
}
