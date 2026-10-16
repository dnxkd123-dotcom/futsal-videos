import { useEffect, useRef, useState } from 'react';

/** 화면 폭 조건이 맞는지 (창 크기를 바꾸면 따라 바뀐다) */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/**
 * 무한 스크롤용. 바닥 표시(sentinelRef)가 화면 근처에 오면 limit 을 pageSize 만큼 늘린다.
 * resetKey 가 바뀌면(필터·정렬) 처음 분량으로 되돌린다.
 */
export function useInfiniteLimit({ total, pageSize, enabled, resetKey }) {
  const [limit, setLimit] = useState(pageSize);
  const sentinelRef = useRef(null);

  useEffect(() => {
    setLimit(pageSize);
  }, [resetKey, pageSize]);

  const hasMore = enabled && limit < total;

  useEffect(() => {
    const node = sentinelRef.current;
    if (!hasMore || !node) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setLimit((value) => value + pageSize);
      },
      { rootMargin: '240px 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
    // limit 이 늘 때마다 다시 붙여서, 아직 화면 안에 있으면 이어서 더 불러온다
  }, [hasMore, limit, pageSize]);

  return { limit, hasMore, sentinelRef };
}
