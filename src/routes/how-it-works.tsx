import React from 'react';
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BadgeCheck } from "lucide-react"; // Kept in case you re-add buttons!
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "How It Works | MatchMax" },
      {
        name: "description",
        content: "Learn how MatchMax works for tutors, from application and verification to student requests.",
      },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: HowItWorksPage,
});

function HowItWorksPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-black">
      <SiteHeader />
      
      <main className="flex-1 flex justify-center bg-white">
        <div
          style={{
            width: '100%',
            maxWidth: 1280, // Updated for responsiveness
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
            display: 'flex',
          }}
        >
          {/* Header Section */}
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

          {/* Illustration Section */}
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
              style={{ flex: '1 1 0', height: 533.33, borderRadius: 16, objectFit: 'cover' }}
              src="https://matchmax.hk/auth-illustration.png"
              alt="About MatchMax Placeholder"
            />
          </div>

          {/* Mission & How it Works Section */}
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