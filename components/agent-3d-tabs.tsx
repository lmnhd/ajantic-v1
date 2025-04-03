"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/src/lib/utils";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "@radix-ui/react-icons";
import { useGlobalStore } from "@/src/lib/store/GloabalStoreState";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { GlobalMessages } from "@/src/lib/types";

type Tab = {
  title: string;
  value: string;
  content?: string | React.ReactNode | any;
};

export const Tabs = ({
  tabs: propTabs,
  setCurrentAgentIndex,
  containerClassName,
  activeTabClassName,
  tabClassName,
  contentClassName,
  addAgent,
  currentIndex,
  globalMessages,
}: {
  tabs: Tab[];
  setCurrentAgentIndex: (idx: number) => void;
  containerClassName?: string;
  activeTabClassName?: string;
  tabClassName?: string;
  contentClassName?: string;
  addAgent?: () => void;
  currentIndex?: number;
  globalMessages: GlobalMessages;
}) => {
  const [active, setActive] = useState<Tab>(propTabs[currentIndex ?? 0]);
  const [tabs, setTabs] = useState<Tab[]>(propTabs);

  const [_currentIndex, _setCurrentIndex] = useState<number | undefined>(currentIndex);

  const moveSelectedTabToTop = (idx: number) => {
    const newTabs = [...propTabs];
    const selectedTab = newTabs.splice(idx, 1);
    newTabs.unshift(selectedTab[0]);
    setTabs(newTabs);
    setActive(newTabs[0]);
    setCurrentAgentIndex(idx);
    _setCurrentIndex(idx);
  };

  const [hovering, setHovering] = useState(false);
  //const { globalMessages, setGlobalMessages, appState, setAppState } =
  //  useGlobalStore();

  const [modelKey, setModelKey] = useState(Date.now().toString());

  useEffect(() => {
    if (_currentIndex !== currentIndex) {
      moveSelectedTabToTop(currentIndex ?? 0);
      _setCurrentIndex(currentIndex);
    }
  }, [currentIndex]);

  // useEffect(() => {
  //   console.log("model changed", globalMessages.currentState.currentModels);
  //   const _time = Date.now().toString();
  //   console.log("time", _time);
  //   setModelKey(_time);
  //   const _idx = propTabs.findIndex((t) => t.value === globalMessages.currentState.currentModels[0].modelName);
  //   moveSelectedTabToTop(_idx);
  // }, [globalMessages.currentState.currentModels]);

  useEffect(() => {
    console.log("PROPTABS SELECTED", globalMessages.currentState.currentAgents);

    //moveSelectedTabToTop(propTabs.length - 1);
    const _idx = propTabs.findIndex(
      (t) => t.value === globalMessages.currentState.currentAgents.agents[0].name
    );
    if (_idx !== -1) {
      moveSelectedTabToTop(_idx);
    }
  }, [propTabs.length]);

  return (
    <>
      <div
        className={cn(
          "flex flex-wrap items-center justify-between [perspective:1000px] relative overflow-auto sm:overflow-visible no-visible-scrollbar max-w-full? w-full bg-black/20 backdrop-blur-md rounded-sm",
          containerClassName
        )}
      >
        {propTabs.map((tab, idx) => (
          <Button
            key={tab.value}
            onClick={() => {
              moveSelectedTabToTop(idx);
            }}
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
            className={cn("relative px-4 py-2 rounded-full", tabClassName)}
            style={{
              transformStyle: "preserve-3d",
            }}
          >
            {active.value === tab.value && (
              <motion.div
                key={active.value}
                layoutId="clickedbutton"
                transition={{ type: "spring", bounce: 0.3, duration: 0.6 }}
                className={cn(
                  "absolute inset-0 bg-gray-200 dark:bg-zinc-800 rounded-full ",
                  activeTabClassName
                )}
              />
            )}

            <span className="relative block text-black dark:text-white">
              {tab.title}
            </span>
          </Button>
        ))}
        <PlusIcon
          onClick={() => {
            console.log("add tab");
            addAgent && addAgent();
          }}
          className="w-6 h-6 cursor-pointer m-4 text-xl"
        />
      </div>
      <FadeInDiv
        tabs={tabs}
        active={active}
        key={active.value}
        hovering={hovering}
        className={cn("mt-6", contentClassName)}
      />
    </>
  );
};

export const FadeInDiv = ({
  className,
  tabs,
  hovering,
}: {
  className?: string;
  key?: string;
  tabs: Tab[];
  active: Tab;
  hovering?: boolean;
}) => {
  const isActive = (tab: Tab) => {
    return tab.value === tabs[0].value;
  };
  return (
    <div className="relative w-full h-full">
      {tabs.map((tab, idx) => (
        <motion.div
          key={tab.value}
          layoutId={tab.value}
          style={{
            scale: 1 - idx * 0.1,
            top: hovering ? idx * -50 : 0,
            zIndex: -idx,
            opacity: idx < 3 ? 1 - idx * 0.1 : 0,
          }}
          animate={{
            y: isActive(tab) ? [0, 40, 0] : 0,
          }}
          className={cn("w-full h-full absolute top-0 left-0", className)}
        >
          {tab.content}
        </motion.div>
      ))}
    </div>
  );
};
