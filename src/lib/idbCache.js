/**
 * IndexedDB 기반 테이블 데이터 캐시
 *
 * 페이지 새로고침/탭 닫기 후에도 데이터 유지
 * → 재방문시 네트워크 없이 즉시 렌더링 가능
 * → 백그라운드에서 최신 데이터로 갱신
 */

const DB_NAME = 'growth-dashboard-cache'
const DB_VERSION = 1
const STORE_NAME = 'table_data'

/* ── DB 열기 (싱글턴) ── */
let _dbPromise = null

function openDB() {
  if (_dbPromise) return _dbPromise

  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' })
      }
    }

    req.onsuccess = () => resolve(req.result)
    req.onerror = () => {
      console.warn('[idbCache] IndexedDB 열기 실패, 폴백으로 동작')
      _dbPromise = null
      reject(req.error)
    }
  })

  return _dbPromise
}

/* ── 데이터 저장 ── */
export async function idbSet(tableName, data) {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)

    store.put({
      key: tableName,
      data,
      ts: Date.now(),
      rowCount: data?.length || 0,
    })

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => reject(tx.error)
    })
  } catch (e) {
    console.warn('[idbCache] 저장 실패:', e)
    return false
  }
}

/* ── 데이터 읽기 ── */
export async function idbGet(tableName, maxAge = 86400000) {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const req = store.get(tableName)

    return new Promise((resolve) => {
      req.onsuccess = () => {
        const entry = req.result
        if (!entry?.data) return resolve(null)

        // maxAge 초과 시 null (기본 24시간)
        if (Date.now() - entry.ts > maxAge) return resolve(null)

        resolve({
          data: entry.data,
          ts: entry.ts,
          rowCount: entry.rowCount,
          age: Date.now() - entry.ts,
        })
      }
      req.onerror = () => resolve(null)
    })
  } catch (e) {
    console.warn('[idbCache] 읽기 실패:', e)
    return null
  }
}

/* ── 특정 테이블 캐시 삭제 ── */
export async function idbDelete(tableName) {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(tableName)
    return new Promise((resolve) => {
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
    })
  } catch {
    return false
  }
}

/* ── 전체 캐시 클리어 ── */
export async function idbClear() {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).clear()
    return new Promise((resolve) => {
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
    })
  } catch {
    return false
  }
}
