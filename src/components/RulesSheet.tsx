export function RulesSheet({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm">
      <div className="panel max-h-[82vh] w-full max-w-md overflow-y-auto p-5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-extrabold text-gold-200">قوانین خوکم</h2>
          <button type="button" className="btn btn-ghost !px-3 !py-1 text-xs" onClick={onClose}>
            بستن
          </button>
        </div>

        <ul className="space-y-2 text-[13px] leading-6 text-white/85">
          <li>• چهار بازیکن، دو تیم دو نفره. دست‌ها شریک‌اند و ۱۳ ترک بازی می‌شود.</li>
          <li>• بازیکن اعلان‌کننده «خوکم» (سوت) را انتخاب می‌کند؛ آس سوت، کارت خوکم است.</li>
          <li>• باید سوت بزنید. اگر نتوانستید، باید خوکم بزنید.</li>
          <li>• اگر خوکمِ بازی‌شده را می‌توانید بزنید، موظفید بزنید.</li>
          <li>• هر کارتِ هم‌سوت برنده‌ی ترک است؛ اگر خوکم زده شود، بالاترین خوکم ترک را می‌برد.</li>
          <li>• برنده‌ی ترک، ترک بعدی را شروع می‌کند.</li>
          <li>• تیمی که ۷ ترک یا بیشتر بگیرد برنده‌ی دست است.</li>
          <li>• گرفتن هر ۱۳ ترک به تیم مقابل بازی را می‌بخشد.</li>
          <li>• اگر تیم برنده، کارت خوکم را نگرفته باشد، دست به تیم مقابل می‌رسد.</li>
          <li>• امتیاز کارت‌ها: آس و ۱۰ ده‌امتیاز، شاه ۴، خانم ۳، ب ۲ و ترک آخر ۱۰ امتیاز.</li>
        </ul>
      </div>
    </div>
  );
}
