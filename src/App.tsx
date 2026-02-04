import React, { useEffect, useRef, useState, useLayoutEffect } from "react";

// --- 유틸리티: 선형 보간 (부드러운 움직임 계산) ---
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
      { threshold: 0.6 }, // 트리거 타이밍 미세 조정
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      // cubic-bezier를 수정하여 더 탄력적인 등장 효과 적용
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

// --- 애니메이션 상태 ---
interface AnimationState {
  currentX: number;
  targetX: number;
  maxScroll: number;
  skew: number; // [추가] 스크롤 속도에 따른 기울기 값
}

const App: React.FC = () => {
  // DOM Refs
  const containerRef = useRef<HTMLElement>(null);
  const progressThumbRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);

  // FLOW Section Refs
  const flowSlideRef = useRef<HTMLElement>(null);
  const flowTextRef = useRef<HTMLDivElement>(null);

  const [introLoaded, setIntroLoaded] = useState(false);

  // [추가] 커서의 부드러운 움직임을 위한 좌표 상태
  const mouse = useRef({ x: 0, y: 0 });
  const cursor = useRef({ x: 0, y: 0 });

  const state = useRef<AnimationState>({
    currentX: 0,
    targetX: 0,
    maxScroll: 0,
    skew: 0, // 초기 기울기 0
  });

  const [, setWindowWidth] = useState(0);

  // [초기화]
  useLayoutEffect(() => {
    setWindowWidth(window.innerWidth);
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }

    setTimeout(() => {
      setIntroLoaded(true);
    }, 100);
  }, []);

  useEffect(() => {
    // 1. 커서 (이벤트에서는 목표 좌표만 저장 -> 애니메이션 루프에서 이동)
    const onMouseMove = (e: MouseEvent) => {
      mouse.current.x = e.clientX;
      mouse.current.y = e.clientY;
    };

    const hoverStart = () => {
      if (cursorRef.current) {
        cursorRef.current.classList.remove("w-5", "h-5");
        cursorRef.current.classList.add("w-8", "h-8", "bg-[#ffea02]/50");
      }
    };

    const hoverEnd = () => {
      if (cursorRef.current) {
        cursorRef.current.classList.remove("w-8", "h-8", "bg-[#ffea02]/50");
        cursorRef.current.classList.add("w-5", "h-5");
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

    // DOM 렌더링 타이밍 고려하여 약간 딜레이 후 이벤트 바인딩
    setTimeout(attachHoverEvents, 500);

    // 2. 레이아웃 계산
    const calculateLayout = () => {
      if (containerRef.current) {
        const viewportWidth = window.innerWidth;
        const totalContainerWidth = containerRef.current.scrollWidth;

        state.current.maxScroll = totalContainerWidth - viewportWidth;
        setWindowWidth(viewportWidth);
      }
    };

    window.addEventListener("resize", calculateLayout);
    setTimeout(calculateLayout, 100);
    setTimeout(calculateLayout, 500);

    // 3. 휠 이벤트
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      state.current.targetX += e.deltaY;
      state.current.targetX = Math.max(
        0,
        Math.min(state.current.targetX, state.current.maxScroll),
      );
    };
    window.addEventListener("wheel", handleWheel, { passive: false });

    // 4. 애니메이션 루프 (Physics Engine)
    let animationFrameId: number;

    const animate = () => {
      // A. 스크롤 물리 엔진 (Inertia + Skew)
      // 부드러운 감속 (0.08 -> 0.07로 미세 조정하여 더 무겁고 고급스러운 느낌)
      state.current.currentX = lerp(
        state.current.currentX,
        state.current.targetX,
        0.05,
      );

      const { currentX, targetX } = state.current;

      // 속도 계산 (현재 위치 - 목표 위치 차이)
      const velocity = targetX - currentX;

      // [핵심] 속도에 따른 기울기(Skew) 계산. 빠를수록 더 많이 기울어짐.
      // maxSkew를 두어 너무 심하게 찌그러지지 않도록 제한
      const targetSkew = velocity * 0.001;
      state.current.skew = lerp(state.current.skew, targetSkew, 0.1); // 기울기도 부드럽게 전환

      // Zoom 효과 (기존 유지하되 연결성 강화)
      const zoomProgress = Math.min(
        Math.abs(currentX) / (window.innerWidth * 0.25),
        1,
      );
      const zoomLevel = 1.5 - zoomProgress * 0.5;

      if (containerRef.current) {
        // SkewX 적용으로 젤리 같은 탄성 효과 부여
        containerRef.current.style.transform = `translate3d(${-currentX}px, 0, 0) scale(${zoomLevel}) skewX(${state.current.skew}deg)`;
      }

      // B. 커서 물리 엔진 (Fluid Follow)
      // 마우스 위치를 즉시 따라가지 않고 lerp로 뒤따라감
      cursor.current.x = lerp(cursor.current.x, mouse.current.x, 0.15);
      cursor.current.y = lerp(cursor.current.y, mouse.current.y, 0.15);

      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate3d(${cursor.current.x}px, ${cursor.current.y}px, 0) translate(-50%, -50%)`;
      }

      // C. FLOW 텍스트 Parallax
      if (flowSlideRef.current && flowTextRef.current) {
        const slideRect = flowSlideRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;

        if (slideRect.right > 0 && slideRect.left < viewportWidth) {
          const offset = viewportWidth - (slideRect.left + slideRect.width / 2);
          // lerp 없이 직접 계산하던 것을 유지하되 계수 조정으로 자연스럽게
          flowTextRef.current.style.transform = `translateX(${-offset * 0.2}px)`; // 속도 조절
        }
      }

      // D. Progress Bar
      if (progressThumbRef.current && state.current.maxScroll > 0) {
        const scrollPercentage = Math.min(
          Math.max(currentX / state.current.maxScroll, 0),
          1,
        );
        const thumbPos = scrollPercentage * 224;
        progressThumbRef.current.style.transform = `translateX(${thumbPos}px) translateY(-50%)`;
      }

      animationFrameId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener("mousemove", onMouseMove); // 기존 moveCursor 제거됨
      window.removeEventListener("resize", calculateLayout);
      window.removeEventListener("wheel", handleWheel);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const copyEmail = (e: React.MouseEvent<HTMLButtonElement>) => {
    const btn = e.currentTarget;
    navigator.clipboard.writeText("pmh3853@naver.com").then(() => {
      const originalText = btn.innerText;
      btn.innerText = "Copied";
      btn.style.color = "#0f0f0f";
      setTimeout(() => {
        btn.innerText = "Email";
        btn.style.color = "#0f0f0f";
      }, 2000);
    });
  };

  // 기존 Hover 함수들은 useEffect 내부 로직으로 통합되었으나,
  // iframe 관련 핸들러는 JSX에서 직접 호출되므로 유지
  const handleIframeEnter = () => {
    if (cursorRef.current) {
      cursorRef.current.style.opacity = "0";
    }
  };

  const handleIframeLeave = () => {
    if (cursorRef.current) {
      cursorRef.current.style.opacity = "1";
    }
  };

  const paddingLeft = "13.333vw";
  const paddingRight = "30vw";

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#e5e5e5]">
      {/* Custom Cursor */}
      <div
        ref={cursorRef}
        // transform은 JS에서 제어하므로 class에서 제거, transition도 JS Lerp와 충돌 방지 위해 제거
        className="fixed top-0 left-0 w-5 h-5 bg-[#0f0f0f]/20 rounded-full pointer-events-none z-[9999]"
      />

      {/* Progress Bar */}
      <div className="fixed top-10 left-1/2 -translate-x-1/2 w-[240px] h-[30px] flex items-center z-50">
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

      {/* Main Container */}
      <main
        ref={containerRef}
        className="flex h-full w-max items-center gap-[2vw] will-change-transform origin-left"
        style={{ paddingLeft, paddingRight }}
      >
        {/* #1 INTRO */}
        <article
          className={`min-w-162.5 w-[40vw] aspect-5/3 bg-[#f7f7f7] overflow-hidden shrink-0 flex flex-col justify-between relative transform-gpu transition-all duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)]
            ${introLoaded ? "opacity-100 scale-100" : "opacity-0 scale-90"}`}
        >
          {/* 2. 원 (Circle) */}
          <div
            className={`absolute right-0 w-[60%] aspect-square bg-[#ffea02] rounded-full transition-all duration-1000 delay-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]
            ${introLoaded ? "scale-100 opacity-100" : "scale-0 opacity-0"}`}
          ></div>

          <div className="w-full h-full p-[2vw] box-border flex flex-col justify-between relative z-10">
            <div className="max-w-3xl">
              <h1
                className={`text-[clamp(1vw,2.6vw,2.6vw)] font-semibold leading-[1.5] transition-all duration-1000 delay-500 ease-[cubic-bezier(0.22,1,0.36,1)]
                ${introLoaded ? "opacity-100 translate-y-0 blur-0" : "opacity-0 translate-y-[40px] blur-[10px]"}`}
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
                className={`text-[clamp(0.5vw,0.7vw,0.7vw)] leading-loose text-gray-800 font-light transition-all duration-1000 delay-700 ease-[cubic-bezier(0.22,1,0.36,1)]
                ${introLoaded ? "opacity-100 translate-y-0 blur-0" : "opacity-0 translate-y-[40px] blur-[10px]"}`}
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
          className="min-w-162.5 w-[40vw] aspect-5/3 bg-[#f7f7f7] overflow-hidden shrink-0 flex flex-col justify-center transform-gpu relative"
        >
          <div className="w-full h-full flex flex-col justify-center z-10 overflow-hidden items-center relative">
            <div
              ref={flowTextRef}
              className="w-full h-full text-[clamp(20vw,20vw,20vw)] leading-none font-[Pretendard] font-medium whitespace-nowrap will-change-transform flex items-center relative"
            >
              Fl&nbsp;
              <span className="inline-block text-[#ff6702] text-[clamp(20vw,20vw,20vw)] leading-none z-10 mx-[-2rem]">
                &nbsp;&nbsp;&nbsp;&nbsp;
                <div className="absolute top-1/2 -right-[13vw] -translate-x-1/2 -translate-y-1/2 h-full aspect-square bg-[#ff6702] rounded-full -z-10" />
              </span>
              &nbsp;w
            </div>
          </div>
        </article>

        {/* #2 PHILOSOPHY (DETAILS) */}
        <article className="min-w-162.5 w-[40vw] aspect-5/3 bg-[#f7f7f7] overflow-hidden shrink-0 flex flex-col justify-center transform-gpu">
          <div className="w-full h-full p-[2vw] box-border flex flex-col justify-center z-10">
            <div className="flex flex-row justify-between h-full items-center">
              <div className="flex items-center pr-10">
                <h2 className="text-[clamp(2.2rem,2.2vw,4.2rem)] font-normal leading-[1.4] tracking-tight break-keep text-[#0f0f0f]">
                  <Reveal delay={0}>가장 중요한 건</Reveal>
                  <Reveal delay={100} className="whitespace-nowrap block">
                    <span className="text-[#ff6702] font-semibold">
                      함께하는 동료&nbsp;
                    </span>
                    입니다
                  </Reveal>
                </h2>
              </div>
              <div className="h-full flex flex-col py-8 justify-between border-l border-black/10 pl-10">
                <div className="hover-target">
                  <Reveal delay={200}>
                    <span className="text-[1.3vw] font-medium mb-2 block tracking-tight">
                      Communication
                    </span>
                    <p className="text-[clamp(0.1vw,0.8vw,0.8vw)] text-[#555] leading-[1.6] font-normal">
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
                    <span className="text-[1.3vw] font-medium mb-2 block tracking-tight">
                      Bright Energy
                    </span>
                    <p className="text-[0.8vw] text-[#555] leading-[1.6] font-normal">
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
        <article className="min-w-162.5 w-[40vw] aspect-5/3 bg-[#ffea02] overflow-hidden shrink-0 flex flex-col justify-center transform-gpu">
          <div className="w-full h-full flex flex-col z-10 overflow-hidden relative p-[2.5vw] ">
            <h1 className="text-[clamp(1vw,2.6vw,2.6vw)] font-semibold leading-[1.3]">
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

        {/* #3 NIZ Detail */}
        <article className="min-w-162.5 w-[40vw] aspect-5/3 bg-[#f7f7f7] overflow-hidden shrink-0 flex flex-col justify-center transform-gpu">
          <div className="flex flex-row justify-between w-full h-full p-[2.5vw]">
            <div className="flex flex-col justify-end">
              <a
                href="https://nizkr.com"
                target="_blank"
                rel="noreferrer"
                className="group flex items-center gap-2 hover-target w-max cursor-none absolute top-[1vw] right-[2vw]"
              >
                <Reveal delay={0}>
                  <h2 className="text-[clamp(10vw,12.5vw,12.5vw)] font-[Pretendard] font-light leading-none group-hover:text-[#ffea02] transition-colors duration-300">
                    Niz
                  </h2>
                </Reveal>
              </a>
              <Reveal delay={400}>
                <p className="text-[clamp(1.2vw,1.4vw,1.4vw)] font-semibold leading-[2vw] mb-5 text-[#ff6702]">
                  아이디어부터 검증까지.
                  <br />
                  <span className="font-normal text-[#0f0f0f]">
                    올라운더의 임팩트.
                  </span>
                </p>
              </Reveal>
              <Reveal delay={500}>
                <p className="text-[0.9vw] font-normal leading-relaxed mb-8">
                  기획, 디자인, 개발, 시장 검증까지
                  <br />
                  비즈니스적 가치를 만들어내는 역량을 증명했습니다.
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
                        className="text-[clamp(0.6vw,0.6vw,0.6vw)] font-normal text-[#0f0f0f] py-1 pr-4 rounded-md mr-[0.2rem] mb-[0.2rem] whitespace-nowrap"
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

        <article className="min-w-162.5 w-[40vw] aspect-5/3 bg-[#f7f7f7] overflow-hidden shrink-0 flex flex-col justify-center transform-gpu">
          <div className="flex flex-row justify-between w-full h-full p-[2.6vw] py-[2.2vw]">
            <a
              href="https://meet--eat.com/"
              target="_blank"
              rel="noreferrer"
              className="group flex items-center gap-2 hover-target cursor-none absolute top-[2vw] right-[2.5vw] z-50"
            >
              <Reveal delay={0}>
                <h2 className="text-[clamp(1vw,5vw,5vw)] font-[Pretendard] font-medium leading-none group-hover:text-[#ffea02] transition-colors duration-300">
                  Meet Eat
                </h2>
              </Reveal>
            </a>
            <a
              href="https://youtu.be/mWBPkVuj4w8"
              target="_blank"
              rel="noreferrer"
              className="group flex items-center gap-2 hover-target w-max cursor-none absolute bottom-[9vw] left-[2.5vw] z-50"
            >
              <Reveal delay={800}>
                <h2 className="text-[clamp(1vw,3.4vw,3.4vw)] font-[Pretendard] font-semibold leading-none group-hover:text-[#ffea02] transition-colors duration-300">
                  Comeback Raindear
                </h2>
              </Reveal>
            </a>
            <Reveal delay={1600}>
              <div className="absolute flex flex-row gap-1 bottom-0 left-0">
                {["Next.js", "Tailwind CSS", "HeroUI", "AWS EC2", "AWS S3"].map(
                  (tag) => (
                    <span
                      key={tag}
                      className="text-[clamp(0.6vw,0.6vw,0.6vw)] font-normal text-[#424242] pt-1 pr-4 rounded-md mr-[0.2rem] whitespace-nowrap"
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
                  <p className="text-[clamp(1vw,1.1vw,1.1vw)] font-medium leading-[2vw] mb-2 text-[#ff6702] ">
                    실시간 위치 기반 식사 매칭
                  </p>
                </Reveal>
                <Reveal delay={500}>
                  <ul className="list-inside text-[0.73vw] font-light space-y-1 text-xs mb-1 leading-relaxed">
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
                        className="text-[clamp(0.6vw,0.6vw,0.6vw)] font-normal text-[#424242] pt-1 pr-4 rounded-md mr-[0.2rem] whitespace-nowrap"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </Reveal>
              </div>
              <div className="text-right">
                <Reveal delay={900}>
                  <p className="text-[clamp(1vw,1vw,1vw)] font-medium leading-[2vw] mb-2 text-[#ff6702] ">
                    랜덤 퀴즈 & 커스터마이징
                  </p>
                </Reveal>
                <Reveal delay={1000}>
                  <ul className="list-inside text-[0.68vw] font-light space-y-1 text-xs mb-1 leading-relaxed">
                    <li>
                      <strong>Interactive:</strong> 동적 CSS 애니메이션
                    </li>
                    <li>
                      <strong>Logic:</strong> 랜덤 순록 조합 및 도감
                    </li>
                    <li>
                      <strong>Infra:</strong> AWS EC2 및 S3 이미지 업로드
                    </li>
                  </ul>
                </Reveal>
              </div>
            </div>
          </div>
        </article>

        {/* #5 FINAL */}
        <article className="min-w-162.5 w-[40vw] aspect-5/3 bg-[#ffea02] overflow-hidden shrink-0 flex flex-col justify-center transform-gpu relative">
          <div className="w-full h-full p-[2.5vw] px-[3.2vw] box-border flex flex-col justify-between font-[Pretendard] text-[clamp(1vw,2.6vw,2.6vw)] font-semibold">
            <button
              onClick={copyEmail}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[#0f0f0f] bg-transparent border-none cursor-none transition-all hover-target hover:scale-110 duration-300"
            >
              Email
            </button>
            <div className="flex flex-col h-full justify-between">
              <div className="flex flex-row justify-between">
                <a
                  href="https://github.com/parkmihyunn"
                  target="_blank"
                  rel="noreferrer"
                  className=" text-[#0f0f0f] no-underline cursor-none transition-all hover-target"
                >
                  Github
                </a>
                <div className="text-[#0f0f0f] bg-transparent border-none cursor-none transition-all">
                  2026
                </div>
              </div>
              <div className="flex flex-row justify-between">
                <div className=" text-[#0f0f0f] bg-transparent border-none cursor-none transition-all">
                  Park
                </div>
                <div className=" text-[#0f0f0f] bg-transparent border-none cursor-none transition-all">
                  Mihyun
                </div>
              </div>
            </div>
          </div>
        </article>
      </main>
    </div>
  );
};

export default App;
