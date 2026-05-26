import loaderVideo from "@/assets/Paperplane.webm";

export default function AppLoader({
  fullScreen = false,
  minHeightClass = "min-h-[300px]",
  overlay = false,
  message = "",
  className = "",
}) {
  const wrapperClass = fullScreen
    ? "grid min-h-full place-items-center"
    : `grid place-items-center ${minHeightClass}`;

  return (
    <div
      className={`${wrapperClass} ${overlay ? "absolute inset-0 bg-white/70" : ""} ${className}`.trim()}
    >
      <div className="flex flex-col items-center justify-center">
        <video
          src={loaderVideo}
          autoPlay
          loop
          muted
          playsInline
          className="h-32 w-32 sm:h-40 sm:w-40"
        />
        {message ? <p className="mt-2 text-sm text-slate-500">{message}</p> : null}
      </div>
    </div>
  );
}
