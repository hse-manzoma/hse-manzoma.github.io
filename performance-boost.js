// ⚡ نظام تحسين الأداء - Performance Optimization System

// 1️⃣ نظام Cache متقدم
const CACHE_SYSTEM = {
  data: new Map(),
  ttl: new Map(),
  DEFAULT_TTL: 5 * 60 * 1000, // 5 دقائق
  
  set(key, value, customTTL = null) {
    this.data.set(key, value);
    this.ttl.set(key, Date.now() + (customTTL || this.DEFAULT_TTL));
  },
  
  get(key) {
    if (!this.data.has(key)) return null;
    
    const expiresAt = this.ttl.get(key);
    if (Date.now() > expiresAt) {
      this.data.delete(key);
      this.ttl.delete(key);
      return null;
    }
    
    return this.data.get(key);
  },
  
  clear() {
    this.data.clear();
    this.ttl.clear();
  }
};

// 2️⃣ نظام Debounce و Throttle
function debounce(fn, delay = 500) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), delay);
  };
}

function throttle(fn, limit = 1000) {
  let lastRun = 0;
  return function(...args) {
    const now = Date.now();
    if (now - lastRun > limit) {
      fn.apply(this, args);
      lastRun = now;
    }
  };
}

// 3️⃣ نظام Lazy Loading
const LAZY_LOADER = {
  pageSize: 50,
  currentPage: 0,
  hasMore: true,
  
  async loadPage(table, filters = {}) {
    const offset = this.currentPage * this.pageSize;
    let query = SB.from(table).select('*', { count: 'exact' });
    
    // تطبيق filters
    for (const [key, value] of Object.entries(filters)) {
      if (value !== null && value !== undefined && value !== '') {
        query = query.eq(key, value);
      }
    }
    
    const { data, count, error } = await query
      .order('id', { ascending: false })
      .range(offset, offset + this.pageSize - 1);
    
    if (error) throw error;
    
    this.hasMore = (offset + this.pageSize) < count;
    this.currentPage++;
    return data;
  },
  
  reset() {
    this.currentPage = 0;
    this.hasMore = true;
  }
};

// 4️⃣ Batch Requests
async function batchInsert(table, records, batchSize = 100) {
  const results = [];
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const { data, error } = await SB.from(table).insert(batch);
    
    if (error) {
      console.error(`Batch ${i}: error`, error);
      continue;
    }
    
    results.push(...(data || []));
  }
  
  return results;
}

// 5️⃣ Request Optimizer
async function optimizedFetch(table, options = {}) {
  const cacheKey = `${table}:${JSON.stringify(options)}`;
  
  // تحقق من Cache
  const cached = CACHE_SYSTEM.get(cacheKey);
  if (cached) {
    console.log('🟢 Cache hit:', cacheKey);
    return cached;
  }
  
  console.log('🔴 Cache miss:', cacheKey);
  
  // Fetch from Supabase
  let query = SB.from(table).select(options.select || '*');
  
  // Apply filters
  if (options.filters) {
    for (const [key, value] of Object.entries(options.filters)) {
      query = query.eq(key, value);
    }
  }
  
  // Apply order
  if (options.order) {
    query = query.order(options.order.field, { ascending: options.order.asc !== false });
  }
  
  // Apply limit
  if (options.limit) {
    query = query.limit(options.limit);
  }
  
  const { data, error } = await query;
  
  if (error) throw error;
  
  // Store in cache
  CACHE_SYSTEM.set(cacheKey, data, options.cacheTTL);
  
  return data;
}

// 6️⃣ Auto Debounced Search
function createDebouncedSearch(delay = 500) {
  return debounce(async (query, table, field) => {
    if (!query.trim()) return [];
    
    const result = await optimizedFetch(table, {
      filters: { [field]: query },
      limit: 20,
      cacheTTL: 2 * 60 * 1000 // 2 دقائق
    });
    
    return result;
  }, delay);
}

// 7️⃣ Request Deduplication
const PENDING_REQUESTS = new Map();

async function dedupRequest(key, requestFn) {
  if (PENDING_REQUESTS.has(key)) {
    return PENDING_REQUESTS.get(key);
  }
  
  const promise = requestFn().finally(() => {
    PENDING_REQUESTS.delete(key);
  });
  
  PENDING_REQUESTS.set(key, promise);
  return promise;
}

// 8️⃣ Network Status Monitor
const NETWORK_MONITOR = {
  isOnline: navigator.onLine,
  queue: [],
  
  init() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processQueue();
      console.log('🟢 Back online');
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('🔴 Went offline');
    });
  },
  
  async enqueue(fn) {
    if (this.isOnline) {
      return fn();
    }
    
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
    });
  },
  
  async processQueue() {
    while (this.queue.length > 0 && this.isOnline) {
      const { fn, resolve, reject } = this.queue.shift();
      try {
        resolve(await fn());
      } catch (e) {
        reject(e);
      }
    }
  }
};

// تهيئة النظام
NETWORK_MONITOR.init();

// 9️⃣ Query String Selection (تحميل حقول محددة فقط)
const OPTIMAL_SELECTS = {
  incidents: 'id,form,date,serial,status,createdAt',
  users: 'id,email,role,name,active',
  employees: 'id,name,code,group,active',
  contractors: 'id,name,contact,active'
};

// مثال على الاستخدام:
/*
// بدل هذا:
const data = await SB.from('incidents').select('*');

// استخدم هذا:
const data = await optimizedFetch('incidents', {
  select: OPTIMAL_SELECTS.incidents,
  limit: 50,
  order: { field: 'date', asc: false }
});
*/

console.log('⚡ Performance optimization system loaded');
