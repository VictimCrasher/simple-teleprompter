import { useState, useEffect, useRef, useCallback, useMemo } from "react";

const SPEED_MIN = 1;
const SPEED_MAX = 10;
const PX_PER_SEC_BASE = 5;
const PX_PER_SEC_PER_UNIT = 3;
const LINE_STEP_PX = 28;

function getPxPerSecond(speed: number) {
	return PX_PER_SEC_BASE + speed * PX_PER_SEC_PER_UNIT;
}

/** Max characters per segment so each fits one line in the reading strip (text-xl, ~48rem width). */
const MAX_CHARS_PER_LINE = 72;

function splitLongSegment(segment: string): string[] {
	if (segment.length <= MAX_CHARS_PER_LINE) return [segment];
	const chunks: string[] = [];
	let rest = segment.trim();
	while (rest.length > 0) {
		if (rest.length <= MAX_CHARS_PER_LINE) {
			chunks.push(rest);
			break;
		}
		const slice = rest.slice(0, MAX_CHARS_PER_LINE + 1);
		const lastSpace = slice.lastIndexOf(" ");
		const breakAt = lastSpace > 0 ? lastSpace + 1 : MAX_CHARS_PER_LINE;
		chunks.push(rest.slice(0, breakAt).trim());
		rest = rest.slice(breakAt).trim();
	}
	return chunks;
}

function getSegments(text: string): string[] {
	const byParagraph = text.split(/[\n\n]+|\n/);
	let segments: string[];
	if (byParagraph.length > 1) {
		segments = byParagraph;
	} else {
		const byLine = text.split(/\n/);
		segments = byLine.length > 1 ? byLine : [text];
	}
	const withEmptyBetween = segments.length > 1 ? segments.flatMap((s, i) => (i === 0 ? [s] : ["\n", s])) : segments;
	return withEmptyBetween.flatMap(splitLongSegment);
}

export default function TeleprompterView() {
	const [config, setConfig] = useState<{
		text: string;
		speed: number;
		alwaysOnTop: boolean;
		alignment?:
			| "top-left"
			| "top"
			| "top-right"
			| "left"
			| "middle"
			| "right"
			| "bottom-left"
			| "bottom"
			| "bottom-right";
	} | null>(null);
	const [playing, setPlaying] = useState(false);
	const [currentSpeed, setCurrentSpeed] = useState(5);
	const [scrollPosition, setScrollPosition] = useState(0);
	const [alwaysOnTop, setAlwaysOnTop] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);
	const rafRef = useRef<number>(0);
	const lastTimeRef = useRef<number>(0);

	const segments = useMemo(() => (config?.text ? getSegments(config.text) : []), [config?.text]);
	const maxScroll = useRef(0);
	const viewportHeight = useRef(0);

	useEffect(() => {
		const handler = (
			_event: unknown,
			payload: {
				text: string;
				speed: number;
				alwaysOnTop: boolean;
				alignment?:
					| "top-left"
					| "top"
					| "top-right"
					| "left"
					| "middle"
					| "right"
					| "bottom-left"
					| "bottom"
					| "bottom-right";
			},
		) => {
			setConfig(payload);
			setCurrentSpeed(payload.speed);
			setAlwaysOnTop(payload.alwaysOnTop);
		};
		window.ipcRenderer.on("teleprompter-config", handler);
		return () => {
			window.ipcRenderer.off("teleprompter-config", handler);
		};
	}, []);

	useEffect(() => {
		if (!config) return;
		setCurrentSpeed(config.speed);

		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [config?.speed]);

	const updateMaxScroll = useCallback(() => {
		const container = containerRef.current;
		const content = contentRef.current;
		if (!container || !content) return;
		viewportHeight.current = container.clientHeight;
		maxScroll.current = Math.max(0, content.scrollHeight - container.clientHeight);
	}, []);

	useEffect(() => {
		updateMaxScroll();
		const ro = new ResizeObserver(updateMaxScroll);
		if (containerRef.current) ro.observe(containerRef.current);
		return () => ro.disconnect();
	}, [config?.text, updateMaxScroll]);

	useEffect(() => {
		if (!playing || !config) return;
		const container = containerRef.current;
		const content = contentRef.current;
		if (!container || !content) return;

		const step = (now: number) => {
			const dt = (now - lastTimeRef.current) / 1000;
			lastTimeRef.current = now;
			const max = Math.max(0, content.scrollHeight - container.clientHeight);
			setScrollPosition((prev) => {
				const next = prev + getPxPerSecond(currentSpeed) * dt;
				if (max > 0 && next >= max) {
					setPlaying(false);
					return max;
				}
				return Math.min(next, max);
			});
			rafRef.current = requestAnimationFrame(step);
		};
		lastTimeRef.current = performance.now();
		rafRef.current = requestAnimationFrame(step);
		return () => cancelAnimationFrame(rafRef.current);
	}, [playing, config, currentSpeed]);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;
		container.scrollTop = scrollPosition;
	}, [scrollPosition]);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;
		const onScroll = () => setScrollPosition(container.scrollTop);
		container.addEventListener("scroll", onScroll, { passive: true });
		return () => container.removeEventListener("scroll", onScroll);
	}, [config]);

	const segmentRefs = useRef<(HTMLParagraphElement | null)[]>([]);

	const getCurrentSegmentIndex = useCallback(() => {
		const container = containerRef.current;
		const refs = segmentRefs.current;
		if (!container || segments.length === 0) return 0;
		const viewportCenter = container.scrollTop + container.clientHeight / 2;
		for (let i = 0; i < segments.length; i++) {
			const el = refs[i];
			if (!el) continue;
			const bottom = el.offsetTop + el.offsetHeight;
			if (bottom > viewportCenter) return i;
		}
		return segments.length - 1;
	}, [segments.length]);

	const goToSegment = useCallback(
		(index: number, direction?: "next" | "prev") => {
			if (segments.length === 0) return;
			let i = Math.max(0, Math.min(index, segments.length - 1));
			const isEmpty = (idx: number) => segments[idx].trim() === "";
			if (isEmpty(i)) {
				if (direction === "next") {
					while (i < segments.length && isEmpty(i)) i++;
					i = Math.min(i, segments.length - 1);
				} else if (direction === "prev") {
					while (i >= 0 && isEmpty(i)) i--;
					i = Math.max(i, 0);
				} else {
					while (i < segments.length && isEmpty(i)) i++;
					if (i >= segments.length) {
						i = index;
						while (i >= 0 && isEmpty(i)) i--;
						i = Math.max(i, 0);
					} else {
						i = Math.min(i, segments.length - 1);
					}
				}
			}
			const el = segmentRefs.current[i];
			const container = containerRef.current;
			if (el && container) {
				const targetScroll = el.offsetTop - container.clientHeight / 2 + el.offsetHeight / 2;
				const clamped = Math.max(0, Math.min(targetScroll, container.scrollHeight - container.clientHeight));
				setScrollPosition(clamped);
				container.scrollTop = clamped;
			}
		},
		[segments],
	);

	const stepScroll = useCallback((direction: 1 | -1) => {
		const container = containerRef.current;
		const content = contentRef.current;
		if (!container || !content) return;
		const max = Math.max(0, content.scrollHeight - container.clientHeight);
		setScrollPosition((prev) => {
			const next = prev + direction * LINE_STEP_PX;
			return Math.max(0, Math.min(next, max));
		});
	}, []);

	const handleReset = useCallback(() => {
		setScrollPosition(0);
		const container = containerRef.current;
		if (container) container.scrollTop = 0;
	}, []);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.code === "Space") {
				e.preventDefault();
				setPlaying((p) => !p);
				return;
			}
			if (e.code === "ArrowDown") {
				e.preventDefault();
				if (segments.length > 1) {
					const current = getCurrentSegmentIndex();
					if (current < segments.length - 1) {
						goToSegment(current + 1, "next");
					} else {
						stepScroll(1);
					}
				} else {
					stepScroll(1);
				}
				return;
			}
			if (e.code === "ArrowUp") {
				e.preventDefault();
				if (segments.length > 1) {
					const current = getCurrentSegmentIndex();
					if (current > 0) {
						goToSegment(current - 1, "prev");
					} else {
						stepScroll(-1);
					}
				} else {
					stepScroll(-1);
				}
				return;
			}
			if (e.code === "ArrowRight" || e.code === "+") {
				e.preventDefault();
				setCurrentSpeed((s) => Math.min(SPEED_MAX, s + 1));
				return;
			}
			if (e.code === "ArrowLeft" || e.code === "-") {
				e.preventDefault();
				setCurrentSpeed((s) => Math.max(SPEED_MIN, s - 1));
				return;
			}
			if (e.code === "Escape") {
				e.preventDefault();
				window.ipcRenderer.invoke("close-teleprompter");
				return;
			}
			if (e.code === "Digit0" || e.code === "Numpad0") {
				e.preventDefault();
				handleReset();
				return;
			}
			if (e.code === "KeyT") {
				e.preventDefault();
				handleAlwaysOnTopChange(!alwaysOnTop);
				return;
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);

		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [segments.length, goToSegment, stepScroll, alwaysOnTop, getCurrentSegmentIndex]);

	const handleAlwaysOnTopChange = (value: boolean) => {
		setAlwaysOnTop(value);
		window.ipcRenderer.invoke("set-always-on-top", { window: "teleprompter", value });
	};

	const progressPercent = maxScroll.current > 0 ? Math.round((scrollPosition / maxScroll.current) * 100) : 0;

	if (!config) {
		return (
			<div className="min-h-screen bg-slate-900 text-slate-300 flex items-center justify-center">
				<p>Waiting for config…</p>
			</div>
		);
	}

	const alignment = config.alignment ?? "middle";
	const isTop = alignment.startsWith("top");
	const isBottom = alignment.startsWith("bottom");
	const isLeft = alignment === "left" || alignment === "top-left" || alignment === "bottom-left";
	const isRight = alignment === "right" || alignment === "top-right" || alignment === "bottom-right";
	const verticalAlign = isTop ? "justify-start" : isBottom ? "justify-end" : "justify-center";
	const textAlign = isLeft ? "text-left" : isRight ? "text-right" : "text-center";
	const horizontalItemsAlign = isLeft ? "items-start" : isRight ? "items-end" : "items-center";

	return (
		<div className="h-screen bg-slate-900 text-slate-100 flex flex-col overflow-hidden min-h-0">
			<div className={`flex-1 min-h-0 flex flex-col ${verticalAlign} overflow-hidden min-h-0`}>
				<div
					className={`relative w-full flex flex-col ${horizontalItemsAlign} shrink-0`}
					style={{ height: "100%" }}
				>
					<div
						className="absolute inset-x-0 top-0 h-8 pointer-events-none z-10"
						style={{
							background: "linear-gradient(to bottom, rgb(15 23 42) 0%, transparent 100%)",
						}}
					/>
					<div
						ref={containerRef}
						className="relative w-full max-w-3xl overflow-y-auto overflow-x-hidden py-2 px-3 scrollbar-hide"
						style={{
							scrollBehavior: "auto",
							height: "100%",
						}}
					>
						<div ref={contentRef} className={`text-xl leading-relaxed ${textAlign}`}>
							{/* Add padding on the top and bottom of the content */}
							<div className="py-0.5" />
							{segments.map((segment, i) => {
                if (segment === "\n") {
                  return <div key={i} className="h-2" />;
                }
								return (
									<p
										key={i}
										ref={(el) => {
											segmentRefs.current[i] = el;
										}}
										className="whitespace-pre-wrap"
									>
										{segment}
									</p>
								);
							})}
							<div className="py-2" />
						</div>
					</div>
					<div
						className="absolute inset-x-0 bottom-0 h-8 pointer-events-none z-10"
						style={{
							background: "linear-gradient(to top, rgb(15 23 42) 0%, transparent 100%)",
						}}
					/>
				</div>
			</div>

			<div className="shrink-0 border-t border-slate-700 bg-slate-800 px-4 py-3 flex flex-wrap items-center gap-2">
				<div className="flex items-center gap-2 min-w-full">
					<span className="text-slate-400 text-sm">Progress</span>
					<div className="flex-1 h-2 w-24 bg-slate-700 rounded-full overflow-hidden">
						<div
							className="h-full bg-sky-500 rounded-full transition-all"
							style={{ width: `${progressPercent}%` }}
						/>
					</div>
					<span className="text-slate-300 text-sm w-10">{progressPercent}%</span>
				</div>

				<div className="flex items-center gap-2 w-full justify-center">
					<button
						type="button"
						onClick={() => setPlaying((p) => !p)}
						className="px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 text-slate-100 font-medium transition flex-1"
					>
						{playing ? "Pause" : "Start"} (Space)
					</button>
					<button
						type="button"
						onClick={handleReset}
						className="px-3 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 text-slate-100 transition"
						title="Scroll back to top"
					>
						Reset (0)
					</button>
					<button
						type="button"
						onClick={() => goToSegment(getCurrentSegmentIndex() - 1, "prev")}
						className="px-3 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 text-slate-100 transition"
						title="Previous (↑)"
					>
						Prev (↑)
					</button>
					<button
						type="button"
						onClick={() => goToSegment(getCurrentSegmentIndex() + 1, "next")}
						className="px-3 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 text-slate-100 transition"
						title="Next (↓)"
					>
						Next (↓)
					</button>

					<div className="flex items-center gap-2">
						<span className="text-slate-400 text-sm">Speed</span>
						<button
							type="button"
							onClick={() => setCurrentSpeed((s) => Math.max(SPEED_MIN, s - 1))}
							className="px-2 py-1 rounded bg-slate-600 hover:bg-slate-500 text-slate-200"
							title="Left arrow"
						>
							−
						</button>
						<span className="text-slate-200 font-mono w-6 text-center">{currentSpeed}</span>
						<button
							type="button"
							onClick={() => setCurrentSpeed((s) => Math.min(SPEED_MAX, s + 1))}
							className="px-2 py-1 rounded bg-slate-600 hover:bg-slate-500 text-slate-200"
							title="Right arrow"
						>
							+
						</button>
					</div>
				</div>

				<div className="flex items-center gap-2">
					<input
						type="checkbox"
						id="tele-always-on-top"
						checked={alwaysOnTop}
						onChange={(e) => handleAlwaysOnTopChange(e.target.checked)}
						className="rounded border-slate-600 bg-slate-700 text-sky-500 focus:ring-sky-500"
					/>
					<label htmlFor="tele-always-on-top" className="text-sm text-slate-300">
						Always on top (T)
					</label>
				</div>

				<button
					type="button"
					onClick={() => window.ipcRenderer.invoke("close-teleprompter")}
					className="ml-auto px-4 py-2 rounded-lg bg-red-900/60 hover:bg-red-800/60 text-red-200 font-medium transition"
				>
					Close (Esc)
				</button>
			</div>
		</div>
	);
}
