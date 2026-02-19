import { useState } from "react";

export type Alignment =
	| "top-left"
	| "top"
	| "top-right"
	| "left"
	| "middle"
	| "right"
	| "bottom-left"
	| "bottom"
	| "bottom-right";

export type WindowHeight = "small" | "medium" | "large";

const ALIGNMENT_GRID: Alignment[][] = [
	["top-left", "top", "top-right"],
	["left", "middle", "right"],
	["bottom-left", "bottom", "bottom-right"],
];

function AlignmentIcon({ align }: { align: Alignment }) {
	const pos: Record<Alignment, string> = {
		"top-left": "top-1 left-1",
		top: "top-1 left-1/2 -translate-x-1/2",
		"top-right": "top-1 right-1",
		left: "top-1/2 -translate-y-1/2 left-1",
		middle: "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
		right: "top-1/2 -translate-y-1/2 right-1",
		"bottom-left": "bottom-1 left-1",
		bottom: "bottom-1 left-1/2 -translate-x-1/2",
		"bottom-right": "bottom-1 right-1",
	};
	return (
		<span className="relative block h-full w-full">
			<span className={`absolute h-1.5 w-1.5 rounded-full bg-current ${pos[align]}`} />
		</span>
	);
}

const CONTROLS_INFO = `• Space — Play / Pause
• Esc — Close Teleprompter Window
• 0 — Reset to top
• T — Toggle Teleprompter Window Always on Top
• ↑ / ↓ — Previous / Next segment
• ← / → or + / - — Decrease / Increase speed`;

export default function ConfigView() {
	const [text, setText] = useState("");
	const [speed, setSpeed] = useState(5);
	const [alwaysOnTop, setAlwaysOnTop] = useState(false);
	const [alignment, setAlignment] = useState<Alignment>("top");
	const [windowHeight, setWindowHeight] = useState<WindowHeight>("medium");
	const [loadedFileName, setLoadedFileName] = useState<string | null>(null);

	const handleLoadFile = async () => {
		const result = await window.ipcRenderer.invoke("open-txt-dialog");
		if (result.content != null) {
			setText(result.content);
			setLoadedFileName(result.path ? (result.path.split(/[/\\]/).pop() ?? null) : null);
		}
	};

	const handleAlwaysOnTopChange = (value: boolean) => {
		setAlwaysOnTop(value);
		// Only applied to teleprompter window when it opens; config window stays normal
	};

	const handleStart = () => {
		const trimmed = text.trim();
		if (!trimmed) return;
		window.ipcRenderer.invoke("open-teleprompter", {
			text: trimmed,
			speed,
			alwaysOnTop,
			alignment,
			windowHeight,
		});
	};

	return (
		<div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-6">
			<div className="w-full max-w-xl space-y-4">
				<h1 className="text-2xl font-bold text-center mb-0">Simple Teleprompter</h1>
				<h2 className="text-xl text-center text-slate-400">A simple teleprompter for your scripts</h2>

				<div>
					<label className="block text-sm font-medium text-slate-300 mb-1">Script text</label>
					<textarea
						value={text}
						onChange={(e) => setText(e.target.value)}
						placeholder="Type your script or load from file..."
						className="w-full h-32 px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-y text-sm"
						rows={5}
					/>
					<div className="mt-1.5 flex gap-2 items-center">
						<button
							type="button"
							onClick={handleLoadFile}
							className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition"
						>
							Load .txt
						</button>
						{loadedFileName && <span className="text-slate-500 text-xs">Loaded: {loadedFileName}</span>}
					</div>
				</div>

				<div className="flex items-center gap-2 w-full">
					<div className="w-1/2 flex flex-col gap-2">
						<div>
							<label className="block text-sm font-medium text-slate-300 mb-1">Scroll Speed (1–10)</label>
							<div className="flex items-center gap-2">
								<input
									type="range"
									min={1}
									max={10}
									value={speed}
									onChange={(e) => setSpeed(Number(e.target.value))}
									className="flex-1 h-2 rounded-lg appearance-none bg-slate-700 accent-sky-500"
								/>
								<span className="text-slate-200 font-mono w-6 text-sm">{speed}</span>
							</div>
						</div>

						<div>
							<label className="block text-sm font-medium text-slate-300 mb-1">
								Teleprompter Height
							</label>
							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={() => setWindowHeight("small")}
									className={`px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition ${windowHeight === "small" ? "bg-sky-600 text-white" : "bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-200"}`}
								>
									<p>Small</p>
                  <p className="text-xs text-slate-400">(1-2 lines)</p>
								</button>
								<button
									type="button"
									onClick={() => setWindowHeight("medium")}
									className={`px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition ${windowHeight === "medium" ? "bg-sky-600 text-white" : "bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-200"}`}
								>
									<p>Medium</p>
									<p className="text-xs text-slate-400">(3-4 lines)</p>
								</button>
								<button
									type="button"
									onClick={() => setWindowHeight("large")}
									className={`px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition ${windowHeight === "large" ? "bg-sky-600 text-white" : "bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-200"}`}
								>
									<p>Large</p>
									<p className="text-xs text-slate-400">(5+ lines)</p>
								</button>
							</div>
						</div>
					</div>

					<div className="w-1/2 flex flex-col items-center justify-center">
						<label className="block text-sm font-medium text-slate-300 mb-1">Window Alignment</label>
						<div className="inline-grid grid-cols-3 gap-0.5 rounded-lg border border-slate-600 bg-slate-800 p-1 w-fit">
							{ALIGNMENT_GRID.map((row) =>
								row.map((align) => (
									<button
										key={align}
										type="button"
										onClick={() => setAlignment(align)}
										title={align.replace("-", " ")}
										className={`flex h-7 w-7 items-center justify-center rounded transition ${
											alignment === align
												? "bg-sky-600 text-white"
												: "bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-200"
										}`}
									>
										<AlignmentIcon align={align} />
									</button>
								)),
							)}
						</div>
					</div>
				</div>

				<div className="flex items-center gap-2">
					<input
						type="checkbox"
						id="config-always-on-top"
						checked={alwaysOnTop}
						onChange={(e) => handleAlwaysOnTopChange(e.target.checked)}
						className="rounded border-slate-600 bg-slate-700 text-sky-500 focus:ring-sky-500"
					/>
					<label htmlFor="config-always-on-top" className="text-sm text-slate-300">
						Show Teleprompter Window Always on Top
					</label>
				</div>

				<div className="rounded-lg bg-slate-800 border border-slate-600 p-3">
					<p className="text-xs text-slate-400 mb-1.5">Controls (teleprompter)</p>
					<pre className="text-slate-300 text-xs whitespace-pre-wrap font-sans">{CONTROLS_INFO}</pre>
				</div>

				<button
					type="button"
					onClick={handleStart}
					disabled={!text.trim()}
					className="w-full py-2.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold transition text-sm"
				>
					Start
				</button>
        
        <p className="text-center text-xs text-slate-400">
          Vibecoded with ❤️ by Victim_Crasher
        </p>
			</div>
		</div>
	);
}
