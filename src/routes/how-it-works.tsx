import React from 'react';

export const AboutMatchMax: React.FC = () => {
  return (
    <div
      style={{
        width: 1280,
        height: 2189,
        background: 'white',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
        display: 'inline-flex',
      }}
    >
      <div
        style={{
          alignSelf: 'stretch',
          paddingLeft: 240,
          paddingRight: 240,
          paddingTop: 80,
          paddingBottom: 80,
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 32,
          display: 'flex',
        }}
      >
        <div
          style={{
            textAlign: 'center',
            justifyContent: 'center',
            display: 'flex',
            flexDirection: 'column',
            color: 'rgba(0, 0, 0, 0.55)',
            fontSize: 18,
            fontFamily: 'Inter',
            fontWeight: 500,
            lineHeight: '26.10px',
            wordWrap: 'break-word',
          }}
        >
          Aug 2, 2026
        </div>
        <div
          style={{
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: 'center',
            gap: 16,
            display: 'flex',
          }}
        >
          <div
            style={{
              width: 800,
              textAlign: 'center',
              justifyContent: 'center',
              display: 'flex',
              flexDirection: 'column',
              color: 'var(--Deep-Navy, #041344)',
              fontSize: 64,
              fontFamily: 'Inter',
              fontWeight: 700,
              lineHeight: '70.40px',
              wordWrap: 'break-word',
            }}
          >
            About
          </div>
          <div
            style={{
              textAlign: 'center',
              justifyContent: 'center',
              display: 'flex',
              flexDirection: 'column',
              color: 'rgba(0, 0, 0, 0.55)',
              fontSize: 18,
              fontFamily: 'Inter',
              fontWeight: 500,
              lineHeight: '26.10px',
              wordWrap: 'break-word',
            }}
          >
            Founder of MatchMax
          </div>
        </div>
      </div>

      <div
        style={{
          alignSelf: 'stretch',
          paddingBottom: 40,
          paddingLeft: 240,
          paddingRight: 240,
          justifyContent: 'center',
          alignItems: 'flex-start',
          display: 'inline-flex',
        }}
      >
        <img
          style={{ flex: '1 1 0', height: 533.33, borderRadius: 16 }}
          src="https://matchmax.hk/auth-illustration.png"
          alt="About MatchMax Placeholder"
        />
      </div>

      <div
        style={{
          alignSelf: 'stretch',
          paddingLeft: 240,
          paddingRight: 240,
          paddingTop: 80,
          paddingBottom: 80,
          justifyContent: 'center',
          alignItems: 'flex-start',
          display: 'inline-flex',
        }}
      >
        <div
          style={{
            flex: '1 1 0',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
            gap: 48,
            display: 'inline-flex',
          }}
        >
          <div
            style={{
              alignSelf: 'stretch',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              alignItems: 'flex-start',
              gap: 16,
              display: 'flex',
            }}
          >
            <div
              style={{
                alignSelf: 'stretch',
                justifyContent: 'center',
                display: 'flex',
                flexDirection: 'column',
                color: 'var(--Deep-Navy, #041344)',
                fontSize: 24,
                fontFamily: 'Inter',
                fontWeight: 600,
                lineHeight: '28.80px',
                wordWrap: 'break-word',
              }}
            >
              Our mission
            </div>
            <div
              style={{
                alignSelf: 'stretch',
                justifyContent: 'center',
                display: 'flex',
                flexDirection: 'column',
                color: 'black',
                fontSize: 18,
                fontFamily: 'Inter',
                fontWeight: 500,
                lineHeight: '26.10px',
                wordWrap: 'break-word',
              }}
            >
              We started off as a bunch of high school seniors helping freshmen
              transition into high school. As goofy as we were, we eventually came
              to realize how valuable this help is and can be! Now, we’ve evolved
              into an educational institute on a mission to help students navigate
              their academic journeys from crushing their courses to applying to
              their dream universities.
            </div>
          </div>
          <div
            style={{
              alignSelf: 'stretch',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              alignItems: 'flex-start',
              gap: 16,
              display: 'flex',
            }}
          >
            <div
              style={{
                alignSelf: 'stretch',
                justifyContent: 'center',
                display: 'flex',
                flexDirection: 'column',
                color: 'var(--Deep-Navy, #041344)',
                fontSize: 24,
                fontFamily: 'Inter',
                fontWeight: 600,
                lineHeight: '28.80px',
                wordWrap: 'break-word',
              }}
            >
              How this works
            </div>
            <div
              style={{
                alignSelf: 'stretch',
                justifyContent: 'center',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <span
                style={{
                  color: 'black',
                  fontSize: 18,
                  fontFamily: 'Inter',
                  fontWeight: 500,
                  lineHeight: '26.10px',
                  wordWrap: 'break-word',
                }}
              >
                We match you with experienced top scorers in these programs and
                fields, where you can learn to excel just like them, via tailored 1
                on 1 tutoring. These tutors are not just tutors, they will be your{' '}
              </span>
              <span
                style={{
                  color: 'var(--Royal-Navy, #0A245F)',
                  fontSize: 18,
                  fontFamily: 'Inter',
                  fontWeight: 700,
                  lineHeight: '26.10px',
                  wordWrap: 'break-word',
                }}
              >
                friend
              </span>
              <span
                style={{
                  color: 'black',
                  fontSize: 18,
                  fontFamily: 'Inter',
                  fontWeight: 500,
                  lineHeight: '26.10px',
                  wordWrap: 'break-word',
                }}
              >
                ,{' '}
              </span>
              <span
                style={{
                  color: 'var(--Royal-Navy, #0A245F)',
                  fontSize: 18,
                  fontFamily: 'Inter',
                  fontWeight: 700,
                  lineHeight: '26.10px',
                  wordWrap: 'break-word',
                }}
              >
                mentor
              </span>
              <span
                style={{
                  color: 'black',
                  fontSize: 18,
                  fontFamily: 'Inter',
                  fontWeight: 500,
                  lineHeight: '26.10px',
                  wordWrap: 'break-word',
                }}
              >
                , your point of contact when you’re stuck with anything school(or
                life!) related, and someone you can look up to..
              </span>
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          alignSelf: 'stretch',
          height: 252,
          paddingLeft: 240,
          paddingRight: 240,
          paddingTop: 80,
          paddingBottom: 80,
          overflow: 'hidden',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 48,
          display: 'flex',
        }}
      >
        <div
          style={{
            alignSelf: 'stretch',
            textAlign: 'center',
            justifyContent: 'center',
            display: 'flex',
            flexDirection: 'column',
            color: 'var(--Royal-Navy, #0A245F)',
            fontSize: 48,
            fontFamily: 'Inter',
            fontWeight: 700,
            lineHeight: '62.40px',
            wordWrap: 'break-word',
          }}
        >
          “We are a bunch of students working for students”
        </div>
        <div
          style={{
            justifyContent: 'flex-start',
            alignItems: 'center',
            gap: 16,
            display: 'inline-flex',
          }}
        >
          <img
            style={{ width: 64, height: 64, borderRadius: 8 }}
            src="https://matchmax.hk/apple-touch-icon.png"
            alt="Founder Avatar"
          />
          <div
            style={{
              flexDirection: 'column',
              justifyContent: 'flex-start',
              alignItems: 'flex-start',
              gap: 4,
              display: 'inline-flex',
            }}
          >
            <div
              style={{
                color: 'black',
                fontSize: 24,
                fontFamily: 'Inter',
                fontWeight: 600,
                lineHeight: '33.60px',
                wordWrap: 'break-word',
              }}
            >
              Full name
            </div>
            <div
              style={{
                justifyContent: 'center',
                display: 'flex',
                flexDirection: 'column',
                color: 'rgba(0, 0, 0, 0.55)',
                fontSize: 18,
                fontFamily: 'Inter',
                fontWeight: 500,
                lineHeight: '26.10px',
                wordWrap: 'break-word',
              }}
            >
              Founder of MatchMax
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          alignSelf: 'stretch',
          height: 399,
          paddingTop: 80,
          paddingBottom: 120,
          paddingLeft: 240,
          paddingRight: 240,
          justifyContent: 'center',
          alignItems: 'flex-start',
          display: 'inline-flex',
        }}
      >
        <div
          style={{
            flex: '1 1 0',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
            gap: 16,
            display: 'inline-flex',
          }}
        >
          <div
            style={{
              alignSelf: 'stretch',
              justifyContent: 'center',
              display: 'flex',
              flexDirection: 'column',
              color: 'var(--Deep-Navy, #041344)',
              fontSize: 24,
              fontFamily: 'Inter',
              fontWeight: 600,
              lineHeight: '28.80px',
              wordWrap: 'break-word',
            }}
          >
            Join Our MatchMax Network
          </div>
          <div
            style={{
              alignSelf: 'stretch',
              justifyContent: 'center',
              display: 'flex',
              flexDirection: 'column',
              color: 'black',
              fontSize: 18,
              fontFamily: 'Inter',
              fontWeight: 500,
              lineHeight: '26.10px',
              wordWrap: 'break-word',
            }}
          >
            MatchMax is Hong Kong's fast-growing academic matching platform, built
            to help tutors grow their teaching careers without the hassle of
            finding students. We take care of marketing, client acquisition, and
            student matching, allowing you to focus on what you do best—teaching.
            Every tutor also receives free personal branding through a
            professionally designed profile featured on our website and Instagram,
            helping you stand out to prospective families. With an average matching
            turnaround of around 1.5 weeks and a transparent commission structure
            that applies only to the 1st and 11th lesson of each student contract,
            you keep 100% of your earnings from every other lesson. It's a
            simpler, fairer way to build your tutoring business.
          </div>
        </div>
      </div>
    </div>
  );
};