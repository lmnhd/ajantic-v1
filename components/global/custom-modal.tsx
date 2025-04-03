import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'

import React from 'react'
import { Button } from '../ui/button'

type Props = {
  title: string
  subheading: string
  children: React.ReactNode
}

const CustomModal = ({ children, subheading, title }: Props) => {
  return (
    <Drawer>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="text-center">{title}</DrawerTitle>
          <DrawerDescription className="text-center flex flex-col items-center gap-4 h-96 overflow-scroll">
            {subheading}
            {children}
          </DrawerDescription>
        </DrawerHeader>
        <DrawerFooter className="flex flex-col gap-4 bg-background border-t-[1px] border-t-muted">
          <DrawerClose>
            <Button
              variant="ghost"
              className="w-full"
            >
              Close
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

export default CustomModal