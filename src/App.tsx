import React, { useEffect, useRef, useState, useLayoutEffect } from "react";

// --- 유틸리티: 선형 보간 ---
const lerp = (start: number, end: number, factor: number) => {
  return start + (end - start) * factor;
};

const Reveal = ({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-1000 ease-[cubic-bezier(0.25,1,0.5,1)] transform
        ${
          isVisible
            ? "opacity-100 translate-y-0 blur-0"
            : "opacity-0 translate-y-[30px] blur-[10px]"
        } 
        ${className}`}
    >
      {children}
    </div>
  );
};

interface AnimationState {
  currentX: number;
  targetX: number;
  maxScroll: number;
  skew: number;
}

const App: React.FC = () => {
  const containerRef = useRef<HTMLElement>(null);
  const progressThumbRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const flowSlideRef = useRef<HTMLElement>(null);
  const flowTextRef = useRef<HTMLDivElement>(null);

  const [introLoaded, setIntroLoaded] = useState(false);
  const mouse = useRef({ x: 0, y: 0 });
  const cursor = useRef({ x: 0, y: 0 });
  const state = useRef<AnimationState>({
    currentX: 0,
    targetX: 0,
    maxScroll: 0,
    skew: 0,
  });

  const [isVertical, setIsVertical] = useState(false);

  useLayoutEffect(() => {
    const checkLayout = () => {
      // 1024px 이하일 때 세로 모드 활성화
      setIsVertical(window.innerWidth < 1024);
    };
    checkLayout();
    window.addEventListener("resize", checkLayout);

    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }

    setTimeout(() => {
      setIntroLoaded(true);
    }, 100);

    return () => window.removeEventListener("resize", checkLayout);
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      mouse.current.x = e.clientX;
      mouse.current.y = e.clientY;
    };

    const hoverStart = () => {
      if (cursorRef.current) {
        cursorRef.current.classList.remove("lg:w-5", "lg:h-5");
        cursorRef.current.classList.add("lg:w-8", "lg:h-8", "bg-[#ffea02]/50");
      }
    };

    const hoverEnd = () => {
      if (cursorRef.current) {
        cursorRef.current.classList.remove(
          "lg:w-8",
          "lg:h-8",
          "bg-[#ffea02]/50",
        );
        cursorRef.current.classList.add("lg:w-5", "lg:h-5");
      }
    };

    window.addEventListener("mousemove", onMouseMove);

    const attachHoverEvents = () => {
      const targets = document.querySelectorAll(".hover-target");
      targets.forEach((el) => {
        el.addEventListener("mouseenter", hoverStart);
        el.addEventListener("mouseleave", hoverEnd);
      });
      return () => {
        targets.forEach((el) => {
          el.removeEventListener("mouseenter", hoverStart);
          el.removeEventListener("mouseleave", hoverEnd);
        });
      };
    };

    setTimeout(attachHoverEvents, 500);

    const calculateLayout = () => {
      if (containerRef.current && window.innerWidth >= 1024) {
        state.current.maxScroll =
          containerRef.current.scrollWidth - window.innerWidth;
      }
    };

    window.addEventListener("resize", calculateLayout);
    setTimeout(calculateLayout, 500);

    const handleWheel = (e: WheelEvent) => {
      if (window.innerWidth < 1024) return; // lg 이하에서는 기본 세로 스크롤
      e.preventDefault();
      state.current.targetX += e.deltaY;
      state.current.targetX = Math.max(
        0,
        Math.min(state.current.targetX, state.current.maxScroll),
      );
    };
    window.addEventListener("wheel", handleWheel, { passive: false });

    let animationFrameId: number;
    const animate = () => {
      if (window.innerWidth >= 1024) {
        // Desktop Horizontal Engine
        state.current.currentX = lerp(
          state.current.currentX,
          state.current.targetX,
          0.05,
        );
        const { currentX, targetX } = state.current;
        const velocity = targetX - currentX;
        const targetSkew = velocity * 0.001;
        state.current.skew = lerp(state.current.skew, targetSkew, 0.1);

        const zoomProgress = Math.min(
          Math.abs(currentX) / (window.innerWidth * 0.25),
          1,
        );
        const zoomLevel = 1.5 - zoomProgress * 0.5;

        if (containerRef.current) {
          containerRef.current.style.transform = `translate3d(${-currentX}px, 0, 0) scale(${zoomLevel}) skewX(${state.current.skew}deg)`;
        }

        if (progressThumbRef.current && state.current.maxScroll > 0) {
          const scrollPercentage = Math.min(
            Math.max(currentX / state.current.maxScroll, 0),
            1,
          );
          progressThumbRef.current.style.transform = `translateX(${scrollPercentage * 224}px) translateY(-50%)`;
        }
      } else {
        // Vertical Mode Reset
        if (containerRef.current) {
          containerRef.current.style.transform = "none";
        }
      }

      // Cursor Physics
      cursor.current.x = lerp(cursor.current.x, mouse.current.x, 0.25);
      cursor.current.y = lerp(cursor.current.y, mouse.current.y, 0.25);
      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate3d(${cursor.current.x}px, ${cursor.current.y}px, 0) translate(-50%, -50%)`;
      }

      // FLOW Text Parallax (가로 모드일 때만 적용되도록 slideRect 기준 계산)
      if (flowSlideRef.current && flowTextRef.current) {
        const slideRect = flowSlideRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        if (slideRect.right > 0 && slideRect.left < viewportWidth) {
          const offset = viewportWidth - (slideRect.left + slideRect.width / 2);
          flowTextRef.current.style.transform = `translateX(${-offset * 0.2}px)`;
        }
      }

      animationFrameId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize", calculateLayout);
      window.removeEventListener("wheel", handleWheel);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const copyEmail = (e: React.MouseEvent<HTMLButtonElement>) => {
    const btn = e.currentTarget;
    navigator.clipboard.writeText("pmh3853@naver.com").then(() => {
      btn.innerText = "Copied";
      setTimeout(() => {
        btn.innerText = "Email";
      }, 2000);
    });
  };

  return (
    <div className="relative w-full h-full overflow-y-auto lg:overflow-hidden bg-[#e5e5e5]">
      {/* Custom Cursor (lg 이상에서만 표시) */}
      <div
        ref={cursorRef}
        className="fixed top-0 left-0 w-5 h-5 bg-[#0f0f0f]/20 rounded-full pointer-events-none z-[9999] hidden lg:block"
      />

      {/* Progress Bar (lg 이상에서만 표시) */}
      <div className="fixed top-10 left-1/2 -translate-x-1/2 w-[240px] h-[30px] hidden lg:flex items-center z-50">
        <div
          className="relative w-full h-4"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, rgba(0,0,0,0.2) 0px, #00000033 1px, transparent 1px, transparent 10px)",
          }}
        >
          <div
            ref={progressThumbRef}
            className="absolute top-1/2 left-0 w-6 h-4.5 bg-[#e5e5e5] border border-[#00000033] box-border z-10"
            style={{ transform: "translateY(-50%)" }}
          />
        </div>
      </div>

      <main
        ref={containerRef}
        className="flex flex-col lg:flex-row h-auto lg:h-full w-full lg:w-max items-center gap-[6vw] lg:gap-[2vw] will-change-transform origin-left py-[4vh] lg:py-0"
        style={{
          paddingLeft: isVertical ? "6vw" : "13.333vw",
          paddingRight: isVertical ? "6vw" : "30vw",
        }}
      >
        {/* #1 INTRO */}
        <article
          className={`min-w-full lg:min-w-162.5 w-full lg:w-[40vw] aspect-5/3 bg-[#f7f7f7] overflow-hidden shrink-0 flex flex-col justify-between relative transform-gpu transition-all duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)] ${introLoaded ? "opacity-100 scale-100" : "opacity-0 scale-90"}`}
        >
          <div
            className={`absolute right-0 w-[60%] aspect-square bg-[#ffea02] rounded-full transition-all duration-1000 delay-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${introLoaded ? "scale-100 opacity-100" : "scale-0 opacity-0"}`}
          ></div>
          <div className="w-full h-full p-[6vw] lg:p-[2vw] box-border flex flex-col justify-between relative z-10">
            <div className="max-w-3xl">
              <h1
                className={`text-[4.7vw] lg:text-[2.6rem] 2xl:text-[2.6vw] font-semibold leading-[1.5] transition-all duration-1000 delay-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${introLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-[40px]"}`}
              >
                Crafting Digital <br />
                &nbsp;&nbsp;Web Experiences
                <br />
                Built With Clear
                <br />
                &nbsp;Purpose & Vision
              </h1>
            </div>
            <div className="mt-4">
              <p
                className={`text-[1.8vw] lg:text-[0.8rem] 2xl:text-[0.7vw] leading-loose text-gray-800 font-light transition-all duration-1000 delay-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${introLoaded ? "opacity-100 translate-y-0" : "opacity-0 translate-y-[40px]"}`}
              >
                단순한 구현을 넘어 사용자의 경험에 공감하는
                <br />
                프론트엔드 개발자 박미현입니다.
                <br />
                논리적인 코드와 감각적인 인터페이스의 조화를 추구합니다.
              </p>
            </div>
          </div>
        </article>

        {/* #2-1 PHILOSOPHY (FLOW) */}
        <article
          ref={flowSlideRef}
          className="min-w-full lg:min-w-162.5 w-full lg:w-[40vw] aspect-5/3 bg-[#f7f7f7] overflow-hidden shrink-0 flex flex-col justify-center transform-gpu relative"
        >
          <div className="w-full h-full flex flex-col justify-center z-10 overflow-hidden items-center relative">
            <div
              ref={flowTextRef}
              className="w-full h-full pl-[6vw] lg:pl-0 text-[35vw] lg:text-[clamp(20rem,20vw,20vw)] leading-none font-[Pretendard] font-medium whitespace-nowrap will-change-transform flex items-center relative"
            >
              Fl&nbsp;
              <span className="inline-block text-[#ff6702] leading-none lg:z-10 m-0 lg:mx-3 -z-10">
                &nbsp;&nbsp;&nbsp;
                <div className="absolute top-1/2 -right-[22%] lg:-right-[30.5%] -translate-x-1/2 -translate-y-1/2 h-full aspect-square bg-[#ff6702] rounded-full -z-10" />
              </span>
              &nbsp;w
            </div>
          </div>
        </article>

        {/* #2 PHILOSOPHY (DETAILS) */}
        <article className="min-w-full lg:min-w-162.5 w-full lg:w-[40vw] aspect-5/3 bg-[#f7f7f7] overflow-hidden shrink-0 flex flex-col justify-center transform-gpu">
          <div className="w-full h-full p-[6vw] lg:p-[3vw] 2xl:p-[2vw] box-border flex flex-col justify-center z-10">
            <div className="flex flex-row justify-between h-full items-center">
              <div className="flex items-center pr-6 lg:pr-10">
                <h2 className="text-[4vw] lg:text-[2.2rem] 2xl:text-[2.2vw] font-normal leading-[1.4] tracking-tight break-keep text-[#0f0f0f]">
                  <Reveal delay={0}>가장 중요한 건</Reveal>
                  <Reveal delay={100} className="whitespace-nowrap block">
                    <span className="text-[#ff6702] font-semibold">
                      함께하는 동료&nbsp;
                    </span>
                    입니다
                  </Reveal>
                </h2>
              </div>
              <div className="h-full flex flex-col py-2 lg:py-8 justify-between border-l border-black/10 pl-6 lg:pl-10">
                <div className="hover-target">
                  <Reveal delay={200}>
                    <span className="text-[2.8vw] lg:text-[1.3rem] 2xl:text-[1.3vw] font-medium mb-2 block tracking-tight">
                      Communication
                    </span>
                    <p className="text-[1.7vw] lg:text-[0.7rem] 2xl:text-[0.8vw] text-[#555] leading-[1.6] font-normal">
                      기획 단계의 적극적인 의견 제시로
                      <br />
                      분위기를 풀고, 데일리 스크럼을
                      <br />
                      주도하여 팀워크를 강화합니다.
                    </p>
                  </Reveal>
                </div>
                <div className="hover-target">
                  <Reveal delay={300}>
                    <span className="text-[2.8vw] lg:text-[1.3rem] 2xl:text-[1.3vw] font-medium mb-2 block tracking-tight">
                      Bright Energy
                    </span>
                    <p className="text-[1.7vw] lg:text-[0.7rem] 2xl:text-[0.8vw] text-[#555] leading-[1.6] font-normal">
                      즐겁고 편안한 분위기가 뒷받침될 때<br />
                      최고의 결과가 나옵니다.
                      <br />
                      긍정적인 에너지를 전파합니다.
                    </p>
                  </Reveal>
                </div>
              </div>
            </div>
          </div>
        </article>

        {/* #3 PROJECT LIST */}
        <article className="min-w-full lg:min-w-162.5 w-full lg:w-[40vw] aspect-5/3 bg-[#ffea02] overflow-hidden shrink-0 flex flex-col justify-center transform-gpu">
          <div className="w-full h-full flex flex-col z-10 overflow-hidden relative p-[6vw] lg:p-[2.5vw]">
            <h1 className="text-[4.7vw] lg:text-[2.6rem] 2xl:text-[2.6vw] font-semibold leading-[1.3]">
              <Reveal delay={0}>Project</Reveal>
              <div className="h-4" />
              <div className="hover-target w-fit">
                <Reveal delay={150}>Niz</Reveal>
              </div>
              <div className="hover-target w-fit">
                <Reveal delay={300}>Meet Eat</Reveal>
              </div>
              <div className="hover-target w-fit">
                <Reveal delay={450}>Comeback Raindear</Reveal>
              </div>
            </h1>
          </div>
        </article>

        {/* #4 NIZ Detail */}
        <article className="min-w-full lg:min-w-162.5 w-full lg:w-[40vw] aspect-5/3 bg-[#f7f7f7] overflow-hidden shrink-0 flex flex-col justify-center transform-gpu">
          <div className="flex flex-row justify-between w-full h-full p-[6vw] lg:p-[2.5vw] relative">
            <div className="flex flex-col justify-end">
              <a
                href="https://nizkr.com"
                target="_blank"
                rel="noreferrer"
                className="group flex items-center gap-2 hover-target lg:cursor-none absolute top-[3vw] lg:top-[1vw] right-[6vw] lg:right-[2vw]"
              >
                <Reveal delay={0}>
                  <h2 className="text-[26.5vw] lg:text-[13rem] 2xl:text-[12.5vw] font-[Pretendard] font-light leading-none group-hover:text-[#ffea02] transition-colors duration-300">
                    Niz
                  </h2>
                </Reveal>
              </a>
              <Reveal delay={400}>
                <p className="text-[2.8vw] lg:text-[1.3rem] 2xl:text-[1.4vw] font-semibold leading-relaxed mb-3 lg:mb-5 text-[#ff6702]">
                  아이디어부터 검증까지.
                  <br />
                  <span className="font-normal text-[#0f0f0f]">
                    올라운더의 임팩트.
                  </span>
                </p>
              </Reveal>
              <Reveal delay={500}>
                <p className="text-[1.8vw] lg:text-[0.9rem] 2xl:text-[0.9vw] font-normal leading-relaxed mb-6 lg:mb-8">
                  기획, 디자인, 개발, 시장 검증까지 비즈니스적 가치를 만들어내는
                  역량을 증명했습니다.
                  <br />
                  <strong>성과:</strong> 초기 사용자 유치 및 피드백 루프 구축.
                </p>
              </Reveal>
              <Reveal delay={600}>
                <div className="flex flex-wrap gap-1">
                  {["Next.js", "TypeScript", "Tailwind CSS", "AWS S3"].map(
                    (tag) => (
                      <span
                        key={tag}
                        className="text-[1.5vw] lg:text-[0.7rem] 2xl:text-[0.6vw] font-normal text-[#0f0f0f] py-1 pr-4 rounded-md whitespace-nowrap"
                      >
                        {tag}
                      </span>
                    ),
                  )}
                </div>
              </Reveal>
            </div>
          </div>
        </article>

        {/* #5 PROJECTS Detail */}
        <article className="min-w-full lg:min-w-162.5 w-full lg:w-[40vw] aspect-5/3 bg-[#f7f7f7] overflow-hidden shrink-0 flex flex-col justify-center transform-gpu">
          <div className="flex flex-row justify-between w-full h-full p-[6vw] lg:p-[2.6vw] 2xl:py-[2.2vw]">
            <a
              href="https://meet--eat.com/"
              target="_blank"
              rel="noreferrer"
              className="group flex items-center gap-2 hover-target cursor-none absolute top-[4vw] right-[5vw] lg:top-[2vw] lg:right-[2.5vw] 2xl:top-[1.8vw] z-50"
            >
              <Reveal delay={0}>
                <h2 className="text-[12vw] lg:text-[5rem] 2xl:text-[5.2vw] font-[Pretendard] font-medium leading-none group-hover:text-[#ffea02] transition-colors duration-300">
                  Meet Eat
                </h2>
              </Reveal>
            </a>
            <a
              href="https://youtu.be/mWBPkVuj4w8"
              target="_blank"
              rel="noreferrer"
              className="group flex items-center gap-2 hover-target w-max cursor-none absolute bottom-[39%] 2xl:bottom-[9.2vw] left-[5.5vw] lg:left-[2.5vw] 2xl:left-[2.2vw] z-50"
            >
              <Reveal delay={800}>
                <h2 className="text-[7vw] lg:text-[3rem] 2xl:text-[3.2vw] font-[Pretendard] font-semibold leading-none group-hover:text-[#ffea02] transition-colors duration-300">
                  Comeback Raindear
                </h2>
              </Reveal>
            </a>
            <Reveal delay={1600}>
              <div className="absolute flex flex-row gap-1 bottom-0 lg:bottom-0.5 left-0">
                {["Next.js", "Tailwind CSS", "HeroUI", "AWS EC2", "AWS S3"].map(
                  (tag) => (
                    <span
                      key={tag}
                      className="text-[1.4vw] lg:text-[0.7rem] 2xl:text-[0.7vw] font-normal text-[#424242] pt-1 pr-1 lg:pr-4 rounded-md mr-[0.2rem] whitespace-nowrap"
                    >
                      {tag}
                    </span>
                  ),
                )}
              </div>
            </Reveal>
            <div className="flex flex-col justify-between w-full">
              <div>
                <Reveal delay={400}>
                  <p className="text-[2.2vw] lg:text-[1.15rem] 2xl:text-[1.1vw]  font-medium leading-[2vw] mb-2 text-[#ff6702] ">
                    실시간 위치 기반 식사 매칭
                  </p>
                </Reveal>
                <Reveal delay={500}>
                  <ul className="list-inside text-[1.55vw] lg:text-[0.85rem] 2xl:text-[0.75vw] font-light space-y-1 text-xs mb-1 leading-relaxed">
                    <li>
                      <strong>SSE & KakaoMap:</strong> 실시간 매칭 구현
                    </li>
                    <li>
                      <strong>최적화:</strong> Debounce 및 Observer
                    </li>
                    <li>
                      <strong>UX:</strong> 반응형 Bottom sheet
                    </li>
                  </ul>
                </Reveal>
                <Reveal delay={600}>
                  <div className="flex flex-wrap gap-1">
                    {[
                      "React",
                      "Vite",
                      "Tailwind CSS",
                      "FramerMotion",
                      "MobX",
                      "MSW",
                      "AWS S3",
                    ].map((tag) => (
                      <span
                        key={tag}
                        className="text-[1.4vw] lg:text-[0.7rem] 2xl:text-[0.7vw] font-normal text-[#424242] pt-1 pr-1 lg:pr-4 rounded-md mr-[0.2rem] whitespace-nowrap"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </Reveal>
              </div>
              <div className="text-right">
                <Reveal delay={900}>
                  <p className="text-[2.2vw] lg:text-[1.15rem] 2xl:text-[1.1vw]  font-medium leading-[2vw] mb-2 text-[#ff6702] ">
                    랜덤 퀴즈 & 커스터마이징
                  </p>
                </Reveal>
                <Reveal delay={1000}>
                  <ul className="list-inside text-[1.55vw] lg:text-[0.85rem] 2xl:text-[0.75vw] font-light space-y-1 text-xs leading-relaxed">
                    <li>
                      <strong>Interactive:</strong> 동적 CSS 애니메이션
                    </li>
                    <li>
                      <strong>Logic:</strong> 랜덤 순록 조합 및 도감
                    </li>
                    <li>
                      <strong>Infra:</strong> AWS EC2 및 S3 업로드
                    </li>
                  </ul>
                </Reveal>
              </div>
            </div>
          </div>
        </article>

        {/* #6 FINAL */}
        <article className="min-w-full lg:min-w-162.5 w-full lg:w-[40vw] aspect-5/3 bg-[#ffea02] overflow-hidden shrink-0 flex flex-col justify-center transform-gpu relative">
          <div className="w-full h-full p-[6vw] lg:p-[2.5vw] box-border flex flex-col justify-between font-[Pretendard] text-[5vw] lg:text-[3vw] 2xl:text-[2.6vw] font-semibold">
            <button
              onClick={copyEmail}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[#0f0f0f] bg-transparent border-none lg:cursor-none transition-all hover-target hover:scale-110 duration-300"
            >
              Email
            </button>
            <div className="flex flex-col h-full justify-between">
              <div className="flex flex-row justify-between">
                <a
                  href="https://github.com/parkmihyunn"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#0f0f0f] no-underline lg:cursor-none hover-target hover:scale-110 transition-all"
                >
                  Github
                </a>
                <div className="text-[#0f0f0f]">2026</div>
              </div>
              <div className="flex flex-row justify-between">
                <div>Park</div>
                <div>Mihyun</div>
              </div>
            </div>
          </div>
        </article>
      </main>
    </div>
  );
};

export default App;
