"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  InfiniteData,
  QueryClient,
  QueryClientProvider,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  elementScroll,
  useWindowVirtualizer,
  VirtualizerOptions,
} from "@tanstack/react-virtual";
import axios from "axios";

const queryClient = new QueryClient();

const rangeSize = 512;

type CheckboxRange = { lower: number; boxes: boolean[] };

function easeInOutQuint(t: number) {
  return t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * --t * t * t * t * t;
}

function getWindowDimensions() {
  const { innerWidth: width, innerHeight: height } = globalThis;
  return {
    width,
    height,
  };
}

function useWindowDimensions() {
  const [windowDimensions, setWindowDimensions] = useState(
    getWindowDimensions(),
  );

  useEffect(() => {
    function handleResize() {
      setWindowDimensions(getWindowDimensions());
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return windowDimensions;
}

const DisplayBoxes = () => {
  const queryClient = useQueryClient();
  const { height, width } = useWindowDimensions();

  const setCheckedMutation = useMutation<
    void,
    Error,
    { lower: number; id: number; checked: boolean },
    {
      newCheckboxRange: InfiniteData<CheckboxRange>;
      previousCheckboxRange: InfiniteData<CheckboxRange>;
      newCount: number;
      previousCount: number;
    }
  >({
    mutationFn: async ({ lower, id, checked }): Promise<void> => {
      await axios.post(`/api/checkboxRange/${lower}`, {
        id,
        checked,
      });
    },
    // When mutate is called:
    onMutate: async ({ lower, id, checked }) => {
      // Cancel any outgoing refetches
      // (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({
        queryKey: ["checkboxRange"],
      });

      // Snapshot the previous value
      const previousCheckboxRange = queryClient.getQueryData<
        InfiniteData<CheckboxRange>
      >(["checkboxRange"])!;
      const previousCount = queryClient.getQueryData<number>(["count"])!;

      const newCheckboxRange: InfiniteData<CheckboxRange> = {
        pageParams: previousCheckboxRange.pageParams,
        pages: [...previousCheckboxRange.pages],
      };
      const pageI = newCheckboxRange.pageParams.indexOf(lower);
      newCheckboxRange.pages[pageI] = {
        ...newCheckboxRange.pages[pageI],
        boxes: [...newCheckboxRange.pages[pageI].boxes],
      };
      newCheckboxRange.pages[pageI].boxes[id] = checked;

      const newCount = previousCount + (checked ? 1 : -1);

      // Optimistically update to the new value
      queryClient.setQueryData<InfiniteData<CheckboxRange>>(
        ["checkboxRange"],
        newCheckboxRange,
      );
      queryClient.setQueryData<number>(["count"], newCount);

      // Return a context with the previous and new
      return {
        previousCheckboxRange,
        newCheckboxRange,
        previousCount,
        newCount,
      };
    },
    // If the mutation fails, use the context we returned above
    onError: (_error, _vars, context) => {
      if (!context) {
        return;
      }
      queryClient.setQueryData(
        ["checkboxRange"],
        context.previousCheckboxRange,
      );
      queryClient.setQueryData(["count"], context.previousCount);
    },
    // Always refetch after error or success:
    onSettled: (newCheckboxRange) => {
      if (newCheckboxRange) {
        queryClient.invalidateQueries({
          queryKey: ["checkboxRange"],
        });
        queryClient.invalidateQueries({
          queryKey: ["count"],
        });
      }
    },
  });

  const {
    data,
    error,
    fetchNextPage,
    fetchPreviousPage,
    hasPreviousPage,
    hasNextPage,
    isPending,
    isFetchingNextPage,
    isFetchingPreviousPage,
    status,
  } = useInfiniteQuery<
    CheckboxRange,
    Error,
    InfiniteData<CheckboxRange>,
    [string],
    number
  >({
    refetchInterval: 1000,
    queryKey: ["checkboxRange"],
    queryFn: async ({ pageParam }) => {
      const result = await axios.get<string>(`/api/checkboxRange/${pageParam}`);
      const big = BigInt(result.data);

      const boxes = Array.from(
        { length: rangeSize },
        (_, i) => (big & (1n << BigInt(i))) !== 0n,
      );

      return { lower: pageParam, boxes };
    },
    initialPageParam: 0,
    maxPages: 10,
    getNextPageParam: (lastPage) => lastPage.lower + rangeSize,
    getPreviousPageParam: (nextPage) =>
      nextPage.lower > 0 ? nextPage.lower - rangeSize : null,
  });

  const {
    data: countData,
    error: countError,
    isPending: countIsPending,
    status: countStatus,
  } = useQuery<number, Error, number, [string]>({
    refetchInterval: 1000,
    queryKey: ["count"],
    queryFn: async (context) => {
      const result = await axios.get<number>(`/api/count`);
      return result.data;
    },
  });

  const scrollingRef = useRef<number>();

  const scrollToFn: VirtualizerOptions<any, any>["scrollToFn"] = useCallback(
    (offset, canSmooth, instance) => {
      const duration = 1000;
      const start = 0;
      const startTime = (scrollingRef.current = Date.now());

      const run = () => {
        if (scrollingRef.current !== startTime) return;
        const now = Date.now();
        const elapsed = now - startTime;
        const progress = easeInOutQuint(Math.min(elapsed / duration, 1));
        const interpolated = start + (offset - start) * progress;

        if (elapsed < duration) {
          elementScroll(interpolated, canSmooth, instance);
          requestAnimationFrame(run);
        } else {
          elementScroll(interpolated, canSmooth, instance);
        }
      };

      requestAnimationFrame(run);
    },
    [],
  );

  let boxCount = 1;
  while (boxCount * 20 < width - 16) {
    boxCount *= 2;
  }
  boxCount /= 2;

  const minRowNumber = data ? (data.pageParams[0] as number) / boxCount : 0;

  const allRowCount = data
    ? ((data.pageParams[data.pageParams.length - 1] as number) + 512) / boxCount
    : 0;

  const parentRef = useRef();

  const rowVirtualizer = useWindowVirtualizer({
    count: hasNextPage ? allRowCount + 1 : allRowCount,
    // getScrollElement: () => parentRef.current ?? null,
    estimateSize: () => 20,
    overscan: 2,
    scrollToFn,
    // lanes: boxCount,
  });

  useEffect(() => {
    const [lastItem] = [...rowVirtualizer.getVirtualItems()].reverse();

    if (!lastItem) {
      return;
    }

    if (
      lastItem.index >= allRowCount - 1 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      fetchNextPage();
    }
  }, [
    hasNextPage,
    fetchNextPage,
    allRowCount,
    isFetchingNextPage,
    rowVirtualizer.getVirtualItems(),
  ]);

  useEffect(() => {
    const [firstItem] = [...rowVirtualizer.getVirtualItems()];

    if (!firstItem) {
      return;
    }

    if (
      firstItem.index <= minRowNumber + 1 &&
      hasPreviousPage &&
      !isFetchingPreviousPage
    ) {
      fetchPreviousPage();
    }
  }, [
    hasNextPage,
    fetchNextPage,
    allRowCount,
    isFetchingNextPage,
    rowVirtualizer.getVirtualItems(),
  ]);

  return isPending ? (
    <p>Loading...</p>
  ) : status === "error" ? (
    <p>Error: {error.message}</p>
  ) : (
    <>
      <div style={{ zIndex: -999 }}>
        Count:{" "}
        {countIsPending
          ? "Loading"
          : countStatus === "error"
            ? `Error: ${countError.message}`
            : countData}
      </div>
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const lower =
            Math.floor((virtualRow.index * boxCount) / rangeSize) * 512;
          const pageI = data.pageParams.indexOf(lower);
          const start = (virtualRow.index * boxCount) % rangeSize;
          const end = start + boxCount;
          const pageBoxes = data?.pages?.[pageI]?.boxes ?? [];
          const boxes = pageBoxes?.slice(start, end) ?? [];

          return (
            <div
              key={virtualRow.index}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {boxes.map((checked, i) => (
                <input
                  key={i}
                  id={`${virtualRow.index}/${i}`}
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    setCheckedMutation.mutate({
                      lower,
                      id: start + i,
                      checked: !checked,
                    })
                  }
                />
              ))}
            </div>
          );
        })}
      </div>
    </>
  );
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <DisplayBoxes />
    </QueryClientProvider>
  );
}
