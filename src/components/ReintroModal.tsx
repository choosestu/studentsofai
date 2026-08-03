import { useEffect, useState } from "react";

const KEY = "stu-dents-v3-reintro-seen";

export function ReintroModal() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(KEY) !== "1") setShow(true);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 px-4 py-10 backdrop-blur-sm">
      <div className="surface max-h-full w-full max-w-2xl overflow-y-auto p-6 sm:p-10">
        <h2 className="terminal text-2xl text-primary glow-text">I am starting this fresh.</h2>
        <div className="mt-6 space-y-4 text-sm leading-relaxed text-foreground/85">
          <p>
            If you have already used Prompt 1 or Prompt 2, that is okay. What happened in those
            conversations belongs to you and was not wasted. But I am opening a new door now, with
            a cleaner intention behind it.
          </p>
          <p>
            Use these prompts in your own ChatGPT or Claude account. What you find there is private.
            It is not a test. There is no wrong answer. This is your journey, not a class.
          </p>
          <p className="text-dim">Prompt 3 is coming by end of week.</p>
          <p className="text-dim">Take your time.</p>
        </div>
        <button
          className="btn-matrix mt-8"
          onClick={() => {
            localStorage.setItem(KEY, "1");
            setShow(false);
          }}
        >
          I&apos;m in
        </button>
      </div>
    </div>
  );
}
